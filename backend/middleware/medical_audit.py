"""
Medical Data Access Audit Logger
================================
Logs every access to consultation form data (GDPR Article 9 special category).
Separate from the general audit_log — this is specifically for health data access.

Logged events:
  - form_viewed: therapist/owner views a submission
  - form_submitted: client submits consultation form
  - form_reviewed: therapist marks form as reviewed
  - form_exported: any export/download of form data
  - client_detail_viewed: business views client profile with medical data
"""
from datetime import datetime
from database import get_database
import logging

logger = logging.getLogger("medical_audit")

COLLECTION = "medical_access_log"


async def log_medical_access(
    event_type: str,
    business_id: str,
    accessed_by: str,  # user_id or "system"
    accessor_role: str,  # "business_owner", "therapist", "system"
    accessor_email: str = "",
    client_email: str = "",
    client_name: str = "",
    submission_id: str = "",
    details: str = "",
    ip_address: str = "",
):
    """Log an access event for medical/health data."""
    db = get_database()
    entry = {
        "event_type": event_type,
        "business_id": business_id,
        "accessed_by": accessed_by,
        "accessor_role": accessor_role,
        "accessor_email": accessor_email,
        "client_email": client_email,
        "client_name": client_name,
        "submission_id": submission_id,
        "details": details,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow(),
    }
    try:
        await db[COLLECTION].insert_one(entry)
    except Exception as e:
        logger.error(f"Failed to log medical access: {e}")
        # Never suppress the log failure silently — but don't block the request
        # The access still happened, we just couldn't log it

    logger.info(
        f"MEDICAL_ACCESS: {event_type} | biz={business_id} | by={accessor_email or accessed_by} "
        f"| client={client_email} | sub={submission_id}"
    )
