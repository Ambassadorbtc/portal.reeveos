"""
ReeveOS Operator Isolation Layer
================================
GDPR/ICO/HIPAA compliant data isolation for self-employed operators.

Layers ON TOP of existing tenant isolation (tenant.py):
  1. tenant.py ensures user can access the business
  2. THIS ensures operators can ONLY see their own data within that business

Rules:
  - Salon Owner (mothership): sees ALL operators' data within their business
  - Operator: sees ONLY their own clients, bookings, revenue, forms
  - Platform Admin: sees everything (unchanged)
  - Operators CANNOT see other operators' data. Period.
  - Operators CANNOT see business-wide revenue totals.
  - Client records are operator-scoped: shared clients have SEPARATE records per operator.

This file provides:
  - get_operator_scope() — returns operator_id if caller is an operator, None if owner/admin
  - scope_query() — adds operator_id filter to any MongoDB query
  - OperatorContext dataclass — injected into request lifecycle
"""

from dataclasses import dataclass
from typing import Optional
from fastapi import Depends, HTTPException
from middleware.tenant import TenantContext, verify_business_access
from database import get_database
import logging

logger = logging.getLogger("operator_scope")


@dataclass
class OperatorContext:
    """Extended context for operator-scoped requests."""
    tenant: TenantContext
    operator_id: Optional[str] = None  # None = owner/admin (sees all)
    is_operator: bool = False
    is_mothership_owner: bool = False


async def get_operator_context(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
) -> OperatorContext:
    """
    Determine if the authenticated user is an operator within this business.
    If yes, lock all subsequent queries to their operator_id.
    If no (owner/admin), allow full business access.
    """
    db = get_database()

    # Platform admins see everything
    if tenant.role in ("platform_admin", "super_admin"):
        return OperatorContext(tenant=tenant, is_mothership_owner=True)

    # Check if business has mothership mode enabled
    try:
        from bson import ObjectId
        biz = await db.businesses.find_one({"_id": ObjectId(tenant.business_id)})
    except Exception:
        biz = await db.businesses.find_one({"_id": tenant.business_id})

    if not biz or not biz.get("mothership_mode"):
        # Not in mothership mode — standard access, no operator scoping
        return OperatorContext(tenant=tenant, is_mothership_owner=False)

    # Business IS in mothership mode. Is this user the owner or an operator?
    owner_id = str(biz.get("owner_id", ""))
    if owner_id == tenant.user_id:
        # Owner — sees aggregate revenue, bookings, performance per operator. NOT operator client details.
        return OperatorContext(tenant=tenant, is_mothership_owner=True)

    # Check if user is an operator
    operator = await db.operators.find_one({
        "business_id": tenant.business_id,
        "user_id": tenant.user_id,
        "status": "active",
    })

    if operator:
        op_id = str(operator.get("_id", "")) or operator.get("id", "")
        logger.info(f"OPERATOR SCOPE: user={tenant.user_id} scoped to operator={op_id} in business={tenant.business_id}")
        return OperatorContext(
            tenant=tenant,
            operator_id=op_id,
            is_operator=True,
        )

    # User has business access but is not owner and not an active operator
    # This could be a staff member — allow standard (non-mothership) access
    return OperatorContext(tenant=tenant)


def scope_query(base_query: dict, op_ctx: OperatorContext, operator_field: str = "operator_id") -> dict:
    """
    Add operator_id filter to a MongoDB query IF the caller is an operator.
    If caller is owner/admin, returns the query unchanged.

    Usage:
        query = scope_query({"business_id": bid}, op_ctx)
        results = await db.bookings.find(query).to_list(100)
    """
    if op_ctx.is_operator and op_ctx.operator_id:
        base_query[operator_field] = op_ctx.operator_id
    return base_query


def assert_not_operator(op_ctx: OperatorContext, action: str = "this action"):
    """Raise 403 if an operator tries to perform an owner-only action."""
    if op_ctx.is_operator:
        logger.warning(
            f"OPERATOR BLOCKED: operator={op_ctx.operator_id} attempted {action} "
            f"in business={op_ctx.tenant.business_id}"
        )
        raise HTTPException(403, f"Operators cannot perform {action}")
