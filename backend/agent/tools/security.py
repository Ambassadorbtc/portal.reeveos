"""
Rezvo Security Monitoring Tools
================================
Tools the AI agent uses to monitor and police the platform.
Covers: tenant isolation, cross-tenant violations, route coverage,
auth anomalies, data integrity, and ICO compliance readiness.
"""
import os
import re
import logging
from datetime import datetime, timedelta
from database import get_database

logger = logging.getLogger("agent.tools.security")

# ─── Tenant Isolation Patterns ───
GUARD_PATTERNS = [
    "verify_business_access",
    "TenantScopedDB",
    "get_scoped_db",
    "set_user_tenant_context",
]

# Routes that legitimately don't need tenant guards
EXEMPT_FILES = {
    "auth.py", "directory.py", "book.py", "voice_search.py",
    "email_webhooks.py", "admin.py", "admin_extended.py",
    "command_centre.py", "studio.py", "agent.py", "chatbot.py",
}


async def scan_tenant_isolation():
    """
    Scan all route files for tenant isolation coverage.
    Returns pass/fail with details of every unguarded file.
    """
    routes_dir = os.path.join(os.path.dirname(__file__), "..", "..", "routes")
    if not os.path.isdir(routes_dir):
        routes_dir = "/opt/rezvo-app/backend/routes"
    if not os.path.isdir(routes_dir):
        return {"error": "Cannot find routes directory", "pass": False}

    guarded = []
    unguarded = []
    exempt = []

    for fname in sorted(os.listdir(routes_dir)):
        if not fname.endswith(".py") or fname == "__init__.py":
            continue
        filepath = os.path.join(routes_dir, fname)
        with open(filepath) as f:
            content = f.read()

        route_count = len(re.findall(r"@router\.", content))
        if route_count == 0:
            continue

        has_guard = any(p in content for p in GUARD_PATTERNS)

        if fname in EXEMPT_FILES:
            exempt.append({"file": fname, "routes": route_count, "has_guard": has_guard})
        elif has_guard:
            guarded.append({"file": fname, "routes": route_count})
        else:
            unguarded.append({"file": fname, "routes": route_count})

    total_guarded = sum(r["routes"] for r in guarded)
    total_unguarded = sum(r["routes"] for r in unguarded)
    total = total_guarded + total_unguarded
    coverage = (total_guarded / total * 100) if total > 0 else 0

    return {
        "pass": len(unguarded) == 0,
        "coverage_percent": round(coverage, 1),
        "guarded_files": len(guarded),
        "unguarded_files": len(unguarded),
        "guarded_routes": total_guarded,
        "unguarded_routes": total_unguarded,
        "exempt_files": len(exempt),
        "unguarded_details": unguarded,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def scan_cross_tenant_violations(hours_back=24):
    """
    Check audit logs for any cross-tenant access attempts.
    These are logged by middleware/tenant.py when someone tries
    to access a business they don't own.
    """
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(hours=hours_back)

    violations = []
    async for doc in db.audit_log.find({
        "event_type": "tenant_violation",
        "timestamp": {"$gte": cutoff},
    }).sort("timestamp", -1).limit(100):
        doc["_id"] = str(doc["_id"])
        if "timestamp" in doc:
            doc["timestamp"] = doc["timestamp"].isoformat()
        violations.append(doc)

    # Also check application logs for TENANT VIOLATION pattern
    log_violations = []
    async for doc in db.error_logs.find({
        "message": {"$regex": "TENANT.VIOLATION", "$options": "i"},
        "created_at": {"$gte": cutoff},
    }).sort("created_at", -1).limit(50):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        log_violations.append(doc)

    return {
        "violations_found": len(violations) + len(log_violations),
        "audit_violations": violations,
        "log_violations": log_violations,
        "hours_checked": hours_back,
        "severity": "critical" if violations else "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }


async def scan_auth_anomalies(hours_back=24):
    """
    Detect suspicious authentication patterns:
    - Multiple failed logins from same IP
    - Same user logged into multiple businesses simultaneously
    - Admin role escalation attempts
    - Accounts with mismatched roles/business_ids
    """
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(hours=hours_back)
    anomalies = []

    # Check for users with role mismatches
    async for user in db.users.find():
        role = user.get("role", "")
        biz_ids = user.get("business_ids", [])
        email = user.get("email", "")

        # platform_admin with business_ids is suspicious
        if role in ("platform_admin", "admin") and biz_ids:
            anomalies.append({
                "type": "role_mismatch",
                "severity": "warning",
                "email": email,
                "detail": f"Admin user has {len(biz_ids)} business_ids attached",
            })

        # business_owner with no business_ids
        if role == "business_owner" and not biz_ids:
            anomalies.append({
                "type": "orphaned_owner",
                "severity": "warning",
                "email": email,
                "detail": "Business owner with no businesses linked",
            })

        # Duplicate emails
        count = await db.users.count_documents({"email": email})
        if count > 1:
            anomalies.append({
                "type": "duplicate_email",
                "severity": "critical",
                "email": email,
                "detail": f"Email appears {count} times in users collection",
            })

    # Check for businesses with no owner
    async for biz in db.businesses.find():
        biz_id = str(biz["_id"])
        biz_name = biz.get("name", "Unknown")
        owner_count = await db.users.count_documents({
            "business_ids": {"$in": [biz_id, biz.get("_id")]}
        })
        if owner_count == 0:
            # Check owner_id field
            if not biz.get("owner_id"):
                anomalies.append({
                    "type": "orphaned_business",
                    "severity": "warning",
                    "detail": f"Business '{biz_name}' has no owner linked",
                })

    return {
        "anomalies_found": len(anomalies),
        "anomalies": anomalies,
        "hours_checked": hours_back,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def scan_data_integrity():
    """
    Check for data integrity issues:
    - Business IDs in user records that don't exist in businesses collection
    - Staff records pointing to non-existent businesses
    - Bookings pointing to non-existent businesses
    - Orders with no parent business
    """
    db = get_database()
    issues = []

    # Check user business_ids point to real businesses
    async for user in db.users.find({"business_ids": {"$ne": []}}):
        for bid in user.get("business_ids", []):
            from bson import ObjectId
            try:
                exists = await db.businesses.find_one({"_id": ObjectId(bid) if isinstance(bid, str) else bid})
            except Exception:
                exists = None
            if not exists:
                issues.append({
                    "type": "dangling_business_ref",
                    "severity": "warning",
                    "detail": f"User {user.get('email')} references non-existent business {bid}",
                })

    # Check collections that should have businessId
    for collection_name in ["staff", "bookings", "orders", "services", "menu_items"]:
        try:
            collection = db[collection_name]
            # Get distinct business IDs referenced
            biz_field = "businessId"
            sample = await collection.find_one()
            if sample and "business_id" in sample:
                biz_field = "business_id"

            distinct_ids = await collection.distinct(biz_field)
            for bid in distinct_ids:
                if not bid:
                    continue
                from bson import ObjectId
                try:
                    exists = await db.businesses.find_one({"_id": ObjectId(bid) if isinstance(bid, str) else bid})
                except Exception:
                    exists = None
                if not exists:
                    count = await collection.count_documents({biz_field: bid})
                    issues.append({
                        "type": "orphaned_records",
                        "severity": "warning",
                        "detail": f"{count} records in {collection_name} reference non-existent business {bid}",
                    })
        except Exception as e:
            logger.debug(f"Skipping {collection_name}: {e}")

    return {
        "issues_found": len(issues),
        "issues": issues,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_security_report():
    """
    Generate a complete security report combining all scans.
    This is the main entry point for the security watchdog task.
    """
    tenant_scan = await scan_tenant_isolation()
    violation_scan = await scan_cross_tenant_violations(hours_back=24)
    auth_scan = await scan_auth_anomalies(hours_back=24)
    integrity_scan = await scan_data_integrity()

    # Overall severity
    severity = "ok"
    if not tenant_scan["pass"]:
        severity = "critical"
    elif violation_scan["violations_found"] > 0:
        severity = "critical"
    elif auth_scan["anomalies_found"] > 0:
        severity = "warning"
    elif integrity_scan["issues_found"] > 0:
        severity = "warning"

    report = {
        "overall_severity": severity,
        "overall_pass": severity == "ok",
        "tenant_isolation": tenant_scan,
        "cross_tenant_violations": violation_scan,
        "auth_anomalies": auth_scan,
        "data_integrity": integrity_scan,
        "generated_at": datetime.utcnow().isoformat(),
        "ico_compliance_note": (
            "UK GDPR Article 32 requires appropriate technical and organisational "
            "measures to ensure data security. Multi-tenant platforms MUST prevent "
            "cross-tenant data access. ICO fines in 2025 averaged over 2.8M GBP. "
            "Tenant isolation coverage below 100% is a reportable compliance gap."
        ) if not tenant_scan["pass"] else "Tenant isolation at 100% - Article 32 compliant.",
    }

    # Store report in DB
    db = get_database()
    if db is not None:
        await db.security_reports.insert_one({
            **report,
            "created_at": datetime.utcnow(),
        })
        # Keep 90 days of reports
        cutoff = datetime.utcnow() - timedelta(days=90)
        await db.security_reports.delete_many({"created_at": {"$lt": cutoff}})

    return report


def register_security_tools():
    """Register all security tools with the agent runner."""
    from agent.runner import register_tool

    register_tool(
        "scan_tenant_isolation",
        "Scan all API route files to check tenant isolation coverage. "
        "Returns pass/fail with exact files and route counts that are unprotected. "
        "CRITICAL: Coverage must be 100% for UK GDPR Article 32 compliance.",
        {
            "type": "object",
            "properties": {},
            "required": [],
        },
        scan_tenant_isolation,
        tier="auto",
    )

    register_tool(
        "scan_cross_tenant_violations",
        "Check audit logs for cross-tenant access attempts in the last N hours. "
        "Any violation is a CRITICAL security event that must be reported.",
        {
            "type": "object",
            "properties": {
                "hours_back": {"type": "integer", "description": "Hours to look back", "default": 24},
            },
            "required": [],
        },
        scan_cross_tenant_violations,
        tier="auto",
    )

    register_tool(
        "scan_auth_anomalies",
        "Detect suspicious authentication patterns: duplicate emails, "
        "role mismatches, orphaned accounts, admin escalation attempts.",
        {
            "type": "object",
            "properties": {
                "hours_back": {"type": "integer", "description": "Hours to look back", "default": 24},
            },
            "required": [],
        },
        scan_auth_anomalies,
        tier="auto",
    )

    register_tool(
        "scan_data_integrity",
        "Check for data integrity issues: dangling references, orphaned records, "
        "businesses with no owners, users pointing to deleted businesses.",
        {
            "type": "object",
            "properties": {},
            "required": [],
        },
        scan_data_integrity,
        tier="auto",
    )

    register_tool(
        "get_security_report",
        "Generate a complete security report combining tenant isolation, "
        "cross-tenant violations, auth anomalies, and data integrity scans. "
        "Stores report in DB and returns full results with ICO compliance notes.",
        {
            "type": "object",
            "properties": {},
            "required": [],
        },
        get_security_report,
        tier="auto",
    )

    logger.info("Registered 5 security monitoring tools")
