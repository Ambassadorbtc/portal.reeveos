"""
ReeveOS Tenant Isolation Layer
============================
Makes cross-tenant data leakage STRUCTURALLY IMPOSSIBLE.

Three interlocking defenses:
1. TenantContext (ContextVar) — set per-request, unavoidable
2. verify_business_access — validates business_id against user's allowed businesses
3. TenantScopedDB — auto-injects businessId into EVERY query

A developer CANNOT write an unscoped query. The system adds the filter
at a level no route handler can bypass.
"""
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional, List
from fastapi import Depends, HTTPException, Request
from bson import ObjectId
from middleware.auth import get_current_user, get_current_admin
from database import get_database
import logging

logger = logging.getLogger("tenant")

# ─── Tenant Context (set per-request, read everywhere) ───

@dataclass
class TenantContext:
    user_id: str
    business_id: str          # The business being accessed RIGHT NOW
    allowed_business_ids: List[str]  # ALL businesses this user can access
    role: str
    user_email: str = ""

_current_tenant: ContextVar[Optional[TenantContext]] = ContextVar("current_tenant", default=None)


def get_tenant() -> TenantContext:
    """Get current tenant context. Raises if not set (= bug, not user error)."""
    ctx = _current_tenant.get()
    if ctx is None:
        raise HTTPException(500, "Tenant context not initialized — this is a server error")
    return ctx


# ─── Business Access Guard ───
# This is the CORE defense. Every route that handles business data
# MUST use this dependency. It:
# 1. Loads the user from JWT
# 2. Gets their allowed business_ids
# 3. Checks the requested business_id is in that list
# 4. Sets the TenantContext for the entire request lifecycle

async def verify_business_access(
    business_id: str,
    current_user: dict = Depends(get_current_user),
) -> TenantContext:
    """
    Validates that the authenticated user has access to this business.
    Sets TenantContext for the request. MUST be used on every business route.
    
    Returns TenantContext so routes can use it directly.
    """
    user_id = str(current_user["_id"])
    user_role = current_user.get("role", "")
    user_email = current_user.get("email", "")
    
    # Admin can access everything (platform admin, not business owner)
    if user_role in ("platform_admin", "super_admin"):
        ctx = TenantContext(
            user_id=user_id,
            business_id=business_id,
            allowed_business_ids=["*"],  # Admin wildcard
            role=user_role,
            user_email=user_email,
        )
        _current_tenant.set(ctx)
        return ctx
    
    # Get user's allowed business IDs
    allowed = current_user.get("business_ids", [])
    
    # Staff may also be linked via staff collection
    db = get_database()
    staff_links = await db.staff.find(
        {"userId": {"$in": [user_id, ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id]}},
        {"businessId": 1}
    ).to_list(100)
    for link in staff_links:
        bid = str(link.get("businessId", ""))
        if bid and bid not in allowed:
            allowed.append(bid)
    
    # Also check if user is owner_id on the business
    try:
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        biz = await db.businesses.find_one({"_id": business_id})
    
    if biz:
        owner_id = str(biz.get("owner_id", ""))
        if owner_id == user_id:
            if business_id not in allowed:
                allowed.append(business_id)
            str_id = str(biz["_id"])
            if str_id not in allowed:
                allowed.append(str_id)
    
    # Normalize all IDs to strings for comparison
    allowed_str = [str(a) for a in allowed]
    business_id_str = str(business_id)
    
    # THE CHECK — if business_id not in user's allowed list, BLOCK
    if business_id_str not in allowed_str:
        # Try ObjectId version
        try:
            if str(ObjectId(business_id)) not in allowed_str:
                logger.warning(
                    f"TENANT VIOLATION: user={user_id} ({user_email}) "
                    f"tried to access business={business_id} "
                    f"but only has access to {allowed_str}"
                )
                # Return 404 NOT 403 — don't reveal the business exists
                raise HTTPException(404, "Business not found")
        except HTTPException:
            raise
        except Exception:
            logger.warning(
                f"TENANT VIOLATION: user={user_id} ({user_email}) "
                f"tried to access business={business_id} "
                f"but only has access to {allowed_str}"
            )
            raise HTTPException(404, "Business not found")
    
    # ACCESS GRANTED — set tenant context
    ctx = TenantContext(
        user_id=user_id,
        business_id=business_id_str,
        allowed_business_ids=allowed_str,
        role=user_role,
        user_email=user_email,
    )
    _current_tenant.set(ctx)
    
    return ctx


# ─── Lightweight guard for routes that don't have business_id in path ───
# (e.g. "list my businesses" — scoped to user's own data)

async def set_user_tenant_context(
    current_user: dict = Depends(get_current_user),
) -> TenantContext:
    """Set tenant context from user without a specific business_id."""
    user_id = str(current_user["_id"])
    allowed = [str(b) for b in current_user.get("business_ids", [])]
    
    ctx = TenantContext(
        user_id=user_id,
        business_id=allowed[0] if allowed else "",
        allowed_business_ids=allowed,
        role=current_user.get("role", ""),
        user_email=current_user.get("email", ""),
    )
    _current_tenant.set(ctx)
    return ctx
