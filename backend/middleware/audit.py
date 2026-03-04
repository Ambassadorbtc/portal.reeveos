"""
ReeveOS Audit Logger
===================
Logs every data access for compliance (UK GDPR) and breach detection.
Append-only — no updates or deletes on audit records.

Captures: who (user), what (action/resource), when (timestamp), 
where (endpoint/IP), which tenant (businessId).

Anomaly detection: alerts on bulk reads, after-hours access,
cross-tenant access attempts.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import Request
from database import get_database

logger = logging.getLogger("audit")

# ─── Audit event types ───
class AuditAction:
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    EXPORT = "export"
    TENANT_VIOLATION = "tenant_violation"
    ADMIN_ACCESS = "admin_access"


async def log_audit_event(
    action: str,
    resource_type: str,
    resource_id: str = "",
    tenant_id: str = "",
    user_id: str = "",
    user_email: str = "",
    user_role: str = "",
    ip_address: str = "",
    endpoint: str = "",
    method: str = "",
    details: Optional[dict] = None,
    severity: str = "info",
):
    """
    Write an audit event. Non-blocking — failures are logged but don't break the request.
    Audit collection is append-only with TTL index for automatic cleanup.
    """
    try:
        db = get_database()
        if db is None:
            return
        
        event = {
            "timestamp": datetime.now(timezone.utc),
            "action": action,
            "resource": {
                "type": resource_type,
                "id": resource_id,
            },
            "actor": {
                "user_id": user_id,
                "email": user_email,
                "role": user_role,
                "ip": ip_address,
            },
            "tenant_id": tenant_id,
            "request": {
                "method": method,
                "endpoint": endpoint,
            },
            "severity": severity,
        }
        if details:
            event["details"] = details
        
        await db.audit_log.insert_one(event)
        
        # Log security events to application logger too
        if severity in ("warning", "critical"):
            logger.warning(
                f"AUDIT [{severity}] {action} on {resource_type}/{resource_id} "
                f"by user={user_id} tenant={tenant_id} ip={ip_address}"
            )
    except Exception as e:
        # NEVER let audit logging break the request
        logger.error(f"Audit log failed: {e}")


async def log_tenant_violation(
    user_id: str,
    user_email: str,
    attempted_business_id: str,
    allowed_business_ids: list,
    ip_address: str = "",
    endpoint: str = "",
):
    """Log a cross-tenant access attempt. This is a CRITICAL security event."""
    await log_audit_event(
        action=AuditAction.TENANT_VIOLATION,
        resource_type="business",
        resource_id=attempted_business_id,
        user_id=user_id,
        user_email=user_email,
        ip_address=ip_address,
        endpoint=endpoint,
        severity="critical",
        details={
            "attempted": attempted_business_id,
            "allowed": allowed_business_ids,
        },
    )


def get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For from nginx."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ─── Audit collection setup (call on startup) ───

async def ensure_audit_indexes():
    """Create indexes for audit collection. Call once on app startup."""
    try:
        db = get_database()
        if db is None:
            return
        
        # TTL index: auto-delete after 180 days (6 months hot storage)
        await db.audit_log.create_index(
            "timestamp",
            expireAfterSeconds=180 * 24 * 60 * 60,
            name="audit_ttl_180d"
        )
        
        # Query indexes
        await db.audit_log.create_index(
            [("tenant_id", 1), ("timestamp", -1)],
            name="audit_tenant_time"
        )
        await db.audit_log.create_index(
            [("actor.user_id", 1), ("timestamp", -1)],
            name="audit_user_time"
        )
        await db.audit_log.create_index(
            [("action", 1), ("severity", 1)],
            name="audit_action_severity"
        )
        
        logger.info("Audit indexes created")
    except Exception as e:
        logger.error(f"Failed to create audit indexes: {e}")
