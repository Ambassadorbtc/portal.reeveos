"""
ReeveOS EPOS — Tronc Management & Tip Distribution
=====================================================
Full UK Employment (Allocation of Tips) Act 2023 compliance.
Effective from 1 October 2024 — employers MUST:
- Pass on all tips, gratuities and service charges to workers
- Distribute fairly among workers (or use independent tronc master)
- Keep records for 3 years
- Provide written policy on request
- Allow workers to see distribution records

This module handles the complete tronc lifecycle: recording, pooling,
distribution calculation, NI exemption tracking, staff statements,
and HMRC-ready exports.

COMPETITIVE EDGE:
- Epos Now: relies on third-party Grateful app (£ per month extra)
- Toast: no UK tronc support
- Square: manual tip pooling only
- ReeveOS: fully native, zero add-on cost, HMRC-compliant
"""
from fastapi import Depends,  APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta, date
from bson import ObjectId
from database import get_database
from decimal import Decimal, ROUND_HALF_UP
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("tronc")
router = APIRouter(prefix="/tronc", tags=["Tronc & Tips Management"])


# ─── Models ─── #

class TroncPolicy(BaseModel):
    """Written tronc policy — legally required to provide on request."""
    distribution_method: str = "points"  # points, percentage, hours, equal, hybrid
    service_charge_rate: Optional[float] = None  # e.g., 12.5 for 12.5%
    service_charge_mandatory: bool = False
    include_card_tips: bool = True
    include_cash_tips: bool = True
    include_service_charge: bool = True
    tronc_master: Optional[str] = None  # staff member name or "system"
    distribution_frequency: str = "weekly"  # daily, weekly, biweekly, monthly
    distribution_day: Optional[str] = "monday"
    eligible_roles: List[str] = []  # empty = all roles eligible
    excluded_roles: List[str] = []  # e.g., ["owner", "director"]
    points_by_role: Dict[str, int] = {}  # {"waiter": 10, "kitchen": 6, "runner": 4, "bar": 8}
    percentage_by_role: Dict[str, float] = {}  # {"front_of_house": 70, "kitchen": 30}
    minimum_hours_threshold: float = 0  # min hours in period to qualify
    probation_exclusion_weeks: int = 0  # exclude staff in first N weeks
    notes: Optional[str] = None

class TipRecord(BaseModel):
    """Individual tip record linked to an order or standalone."""
    order_id: Optional[str] = None
    table_number: Optional[str] = None
    source: str  # card, cash, service_charge, online
    amount: float
    currency: str = "GBP"
    staff_id: Optional[str] = None  # who received/collected it
    customer_name: Optional[str] = None
    notes: Optional[str] = None

class DistributionRun(BaseModel):
    """Parameters for a distribution calculation run."""
    period_start: str  # YYYY-MM-DD
    period_end: str    # YYYY-MM-DD
    method_override: Optional[str] = None  # override policy method for this run
    notes: Optional[str] = None

class StaffPointsOverride(BaseModel):
    """Override points for a specific staff member in a period."""
    staff_id: str
    points: int
    reason: str

class ManualAdjustment(BaseModel):
    """Manual adjustment to a distribution."""
    staff_id: str
    amount: float
    reason: str


# ─── Tronc Policy Management ─── #

@router.get("/business/{business_id}/policy")
async def get_tronc_policy(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get the current tronc policy. Employees have a legal right to request this."""
    db = get_database()
    policy = await db.tronc_policies.find_one({"business_id": business_id})
    if not policy:
        return {"policy": None, "message": "No tronc policy configured. Required by law if tips are received."}
    policy["_id"] = str(policy["_id"])
    return {"policy": policy}


@router.put("/business/{business_id}/policy")
async def set_tronc_policy(business_id: str, body: TroncPolicy, tenant: TenantContext = Depends(verify_business_access)):
    """Set or update the tronc distribution policy."""
    db = get_database()
    
    valid_methods = ["points", "percentage", "hours", "equal", "hybrid"]
    if body.distribution_method not in valid_methods:
        raise HTTPException(400, f"Invalid method. Valid: {valid_methods}")
    
    if body.distribution_method == "points" and not body.points_by_role:
        raise HTTPException(400, "Points-based distribution requires points_by_role mapping")
    
    if body.distribution_method == "percentage" and not body.percentage_by_role:
        raise HTTPException(400, "Percentage-based distribution requires percentage_by_role mapping")
    
    if body.distribution_method == "percentage":
        total_pct = sum(body.percentage_by_role.values())
        if abs(total_pct - 100) > 0.01:
            raise HTTPException(400, f"Percentage allocations must sum to 100%. Currently: {total_pct}%")
    
    policy_doc = body.dict()
    policy_doc["business_id"] = business_id
    policy_doc["updated_at"] = datetime.utcnow()
    
    await db.tronc_policies.update_one(
        {"business_id": business_id},
        {"$set": policy_doc, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )
    
    await db.tronc_audit.insert_one({
        "business_id": business_id,
        "action": "policy_updated",
        "policy": policy_doc,
        "timestamp": datetime.utcnow()
    })
    
    return {"updated": True}


# ─── Tip Recording ─── #

@router.post("/business/{business_id}/tips")
async def record_tip(business_id: str, body: TipRecord, tenant: TenantContext = Depends(verify_business_access)):
    """
    Record an individual tip. Can be linked to an order or standalone (cash jar).
    Tips are held in the pool until distribution.
    """
    db = get_database()
    
    valid_sources = ["card", "cash", "service_charge", "online"]
    if body.source not in valid_sources:
        raise HTTPException(400, f"Invalid source. Valid: {valid_sources}")
    
    if body.amount <= 0:
        raise HTTPException(400, "Tip amount must be positive")
    
    tip_doc = body.dict()
    tip_doc["business_id"] = business_id
    tip_doc["status"] = "pooled"  # pooled, distributed, voided
    tip_doc["distribution_id"] = None
    tip_doc["created_at"] = datetime.utcnow()
    
    result = await db.tronc_tips.insert_one(tip_doc)
    
    return {"tip_id": str(result.inserted_id), "amount": body.amount, "source": body.source}


@router.post("/business/{business_id}/tips/from-order/{order_id}")
async def record_tip_from_order(business_id: str, order_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """
    Auto-record tips from a completed order.
    Extracts card tips, service charges, and any gratuity from payment data.
    Called automatically when an order is paid.
    """
    db = get_database()
    
    order = await db.orders.find_one(
        {"_id": ObjectId(order_id), "business_id": business_id}
    )
    if not order:
        raise HTTPException(404, "Order not found")
    
    tips_created = []
    
    # Extract card tip
    for payment in order.get("payments", []):
        tip_amount = payment.get("tip_amount", 0)
        if tip_amount > 0:
            tip_doc = {
                "business_id": business_id,
                "order_id": order_id,
                "table_number": order.get("table_number"),
                "source": "card",
                "amount": tip_amount,
                "currency": "GBP",
                "staff_id": order.get("server_id"),
                "status": "pooled",
                "distribution_id": None,
                "created_at": datetime.utcnow()
            }
            result = await db.tronc_tips.insert_one(tip_doc)
            tips_created.append({"id": str(result.inserted_id), "source": "card", "amount": tip_amount})
    
    # Extract service charge
    service_charge = order.get("service_charge_amount", 0)
    if service_charge > 0:
        tip_doc = {
            "business_id": business_id,
            "order_id": order_id,
            "table_number": order.get("table_number"),
            "source": "service_charge",
            "amount": service_charge,
            "currency": "GBP",
            "staff_id": None,
            "status": "pooled",
            "distribution_id": None,
            "created_at": datetime.utcnow()
        }
        result = await db.tronc_tips.insert_one(tip_doc)
        tips_created.append({"id": str(result.inserted_id), "source": "service_charge", "amount": service_charge})
    
    return {"tips_recorded": len(tips_created), "details": tips_created}


@router.get("/business/{business_id}/tips")
async def get_tips(
    business_id: str,
    status: Optional[str] = None,
    source: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    staff_id: Optional[str] = None,
    limit: int = 100,
    tenant: TenantContext = Depends(verify_business_access),
):
    """List tips with filtering."""
    db = get_database()
    query = {"business_id": business_id}
    
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    if staff_id:
        query["staff_id"] = staff_id
    if from_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        query.setdefault("created_at", {})
        query["created_at"]["$lte"] = datetime.fromisoformat(to_date + "T23:59:59")
    
    tips = []
    total = 0
    async for doc in db.tronc_tips.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        tips.append(doc)
        total += doc.get("amount", 0)
    
    return {"tips": tips, "count": len(tips), "total_amount": round(total, 2)}


@router.post("/business/{business_id}/tips/{tip_id}/void")
async def void_tip(business_id: str, tip_id: str, tenant: TenantContext = Depends(verify_business_access), reason: str = Body(..., embed=True)):
    """Void a tip (e.g., payment reversal). Must provide reason for audit trail."""
    db = get_database()
    
    tip = await db.tronc_tips.find_one(
        {"_id": ObjectId(tip_id), "business_id": business_id}
    )
    if not tip:
        raise HTTPException(404, "Tip not found")
    if tip.get("status") == "distributed":
        raise HTTPException(400, "Cannot void a distributed tip. Create an adjustment instead.")
    
    await db.tronc_tips.update_one(
        {"_id": ObjectId(tip_id)},
        {"$set": {"status": "voided", "void_reason": reason, "voided_at": datetime.utcnow()}}
    )
    
    await db.tronc_audit.insert_one({
        "business_id": business_id,
        "action": "tip_voided",
        "tip_id": tip_id,
        "amount": tip["amount"],
        "reason": reason,
        "timestamp": datetime.utcnow()
    })
    
    return {"voided": True}


# ─── Pool Summary ─── #

@router.get("/business/{business_id}/pool")
async def get_tronc_pool(business_id: str, tenant: TenantContext = Depends(verify_business_access), from_date: Optional[str] = None, to_date: Optional[str] = None):
    """
    Get the current undistributed tronc pool summary.
    Shows breakdown by source and total available for distribution.
    """
    db = get_database()
    query = {"business_id": business_id, "status": "pooled"}
    
    if from_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        query.setdefault("created_at", {})
        query["created_at"]["$lte"] = datetime.fromisoformat(to_date + "T23:59:59")
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$source",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    by_source = {}
    grand_total = 0
    async for doc in db.tronc_tips.aggregate(pipeline):
        by_source[doc["_id"]] = {"total": round(doc["total"], 2), "count": doc["count"]}
        grand_total += doc["total"]
    
    return {
        "pool_total": round(grand_total, 2),
        "by_source": by_source,
        "status": "pending_distribution",
        "period": {"from": from_date, "to": to_date}
    }


# ─── Distribution Calculation & Execution ─── #

@router.post("/business/{business_id}/distribute/preview")
async def preview_distribution(business_id: str, body: DistributionRun, tenant: TenantContext = Depends(verify_business_access)):
    """
    Preview (dry run) a distribution calculation without executing it.
    Shows exactly what each staff member would receive.
    """
    db = get_database()
    distribution = await _calculate_distribution(db, business_id, body, preview=True)
    return distribution


@router.post("/business/{business_id}/distribute/execute")
async def execute_distribution(business_id: str, body: DistributionRun, tenant: TenantContext = Depends(verify_business_access)):
    """
    Execute the distribution — marks tips as distributed, creates distribution records,
    and generates staff statements. This action is permanent.
    """
    db = get_database()
    distribution = await _calculate_distribution(db, business_id, body, preview=False)
    
    if distribution.get("error"):
        raise HTTPException(400, distribution["error"])
    
    # Save distribution record
    dist_doc = {
        "business_id": business_id,
        "period_start": body.period_start,
        "period_end": body.period_end,
        "method": distribution["method"],
        "total_pool": distribution["total_pool"],
        "allocations": distribution["allocations"],
        "notes": body.notes,
        "executed_at": datetime.utcnow(),
        "executed_by": "system"
    }
    result = await db.tronc_distributions.insert_one(dist_doc)
    dist_id = str(result.inserted_id)
    
    # Mark all pooled tips in this period as distributed
    period_start = datetime.fromisoformat(body.period_start)
    period_end = datetime.fromisoformat(body.period_end + "T23:59:59")
    
    await db.tronc_tips.update_many(
        {
            "business_id": business_id,
            "status": "pooled",
            "created_at": {"$gte": period_start, "$lte": period_end}
        },
        {"$set": {"status": "distributed", "distribution_id": dist_id}}
    )
    
    # Create individual staff statements
    for alloc in distribution["allocations"]:
        statement = {
            "business_id": business_id,
            "distribution_id": dist_id,
            "staff_id": alloc["staff_id"],
            "staff_name": alloc["staff_name"],
            "role": alloc["role"],
            "period_start": body.period_start,
            "period_end": body.period_end,
            "gross_amount": alloc["amount"],
            "ni_exempt": alloc.get("ni_exempt", True),
            "method": distribution["method"],
            "calculation_detail": alloc.get("calculation_detail", {}),
            "created_at": datetime.utcnow()
        }
        await db.tronc_statements.insert_one(statement)
    
    await db.tronc_audit.insert_one({
        "business_id": business_id,
        "action": "distribution_executed",
        "distribution_id": dist_id,
        "total": distribution["total_pool"],
        "staff_count": len(distribution["allocations"]),
        "timestamp": datetime.utcnow()
    })
    
    distribution["distribution_id"] = dist_id
    distribution["executed"] = True
    return distribution


@router.post("/business/{business_id}/distribute/{distribution_id}/adjust")
async def adjust_distribution(business_id: str, distribution_id: str, body: ManualAdjustment, tenant: TenantContext = Depends(verify_business_access)):
    """Post-distribution manual adjustment (e.g., correction, absence deduction)."""
    db = get_database()
    
    dist = await db.tronc_distributions.find_one(
        {"_id": ObjectId(distribution_id), "business_id": business_id}
    )
    if not dist:
        raise HTTPException(404, "Distribution not found")
    
    adjustment = {
        "business_id": business_id,
        "distribution_id": distribution_id,
        "staff_id": body.staff_id,
        "amount": body.amount,
        "reason": body.reason,
        "created_at": datetime.utcnow()
    }
    await db.tronc_adjustments.insert_one(adjustment)
    
    await db.tronc_audit.insert_one({
        "business_id": business_id,
        "action": "distribution_adjusted",
        "distribution_id": distribution_id,
        "staff_id": body.staff_id,
        "amount": body.amount,
        "reason": body.reason,
        "timestamp": datetime.utcnow()
    })
    
    return {"adjusted": True}


# ─── Distribution History ─── #

@router.get("/business/{business_id}/distributions")
async def get_distributions(business_id: str, tenant: TenantContext = Depends(verify_business_access), limit: int = 20):
    """List past distribution runs."""
    db = get_database()
    
    distributions = []
    async for doc in db.tronc_distributions.find(
        {"business_id": business_id}
    ).sort("executed_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        distributions.append(doc)
    
    return {"distributions": distributions}


@router.get("/business/{business_id}/distributions/{distribution_id}")
async def get_distribution_detail(business_id: str, distribution_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get full detail of a specific distribution run."""
    db = get_database()
    
    dist = await db.tronc_distributions.find_one(
        {"_id": ObjectId(distribution_id), "business_id": business_id}
    )
    if not dist:
        raise HTTPException(404, "Distribution not found")
    
    dist["_id"] = str(dist["_id"])
    
    # Get adjustments
    adjustments = []
    async for adj in db.tronc_adjustments.find({"distribution_id": distribution_id}):
        adj["_id"] = str(adj["_id"])
        adjustments.append(adj)
    
    dist["adjustments"] = adjustments
    return dist


# ─── Staff Statements ─── #

@router.get("/business/{business_id}/staff/{staff_id}/statements")
async def get_staff_statements(business_id: str, staff_id: str, tenant: TenantContext = Depends(verify_business_access), limit: int = 12):
    """
    Get tip distribution statements for a staff member.
    Workers have a legal right to request these (Act 2023, Section 3).
    Must be kept for 3 years.
    """
    db = get_database()
    
    statements = []
    async for doc in db.tronc_statements.find(
        {"business_id": business_id, "staff_id": staff_id}
    ).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        
        # Add any adjustments
        adjustments = []
        async for adj in db.tronc_adjustments.find({
            "distribution_id": doc.get("distribution_id"),
            "staff_id": staff_id
        }):
            adj["_id"] = str(adj["_id"])
            adjustments.append(adj)
        doc["adjustments"] = adjustments
        
        # Calculate net amount
        adj_total = sum(a["amount"] for a in adjustments)
        doc["net_amount"] = round(doc["gross_amount"] + adj_total, 2)
        
        statements.append(doc)
    
    # Annual summary
    year_start = datetime(datetime.utcnow().year, 1, 1)
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "staff_id": staff_id,
            "created_at": {"$gte": year_start}
        }},
        {"$group": {
            "_id": None,
            "annual_total": {"$sum": "$gross_amount"},
            "distribution_count": {"$sum": 1}
        }}
    ]
    annual = None
    async for doc in db.tronc_statements.aggregate(pipeline):
        annual = {"annual_total": round(doc["annual_total"], 2), "distributions": doc["distribution_count"]}
    
    return {
        "statements": statements,
        "annual_summary": annual or {"annual_total": 0, "distributions": 0}
    }


# ─── HMRC Reporting ─── #

@router.get("/business/{business_id}/hmrc/tronc-report")
async def generate_hmrc_tronc_report(
    business_id: str,
    tax_year: str = Query(..., description="Tax year e.g., 2024-25"),
    format: str = "json",
    tenant: TenantContext = Depends(verify_business_access),
):
    """
    Generate HMRC-compliant tronc report for a tax year.
    
    Key NI rules for tronc:
    - Tips distributed by an INDEPENDENT tronc master are exempt from employer NI
    - Tips distributed directly by the employer ARE subject to employer NI
    - All tips are subject to income tax (PAYE) regardless of distribution method
    - Cash tips handled directly by employees are self-reported
    
    The report separates NI-exempt (independent tronc) from NI-liable (employer-distributed).
    """
    db = get_database()
    
    # Parse tax year (UK tax year runs April 6 to April 5)
    parts = tax_year.split("-")
    start_year = int(parts[0])
    period_start = datetime(start_year, 4, 6)
    period_end = datetime(start_year + 1, 4, 5, 23, 59, 59)
    
    # Get policy to determine NI exemption status
    policy = await db.tronc_policies.find_one({"business_id": business_id})
    is_independent_tronc = policy and policy.get("tronc_master") and policy["tronc_master"] != "employer"
    
    # Aggregate by staff
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": period_start, "$lte": period_end}
        }},
        {"$group": {
            "_id": {"staff_id": "$staff_id", "staff_name": "$staff_name"},
            "total_gross": {"$sum": "$gross_amount"},
            "distribution_count": {"$sum": 1}
        }},
        {"$sort": {"_id.staff_name": 1}}
    ]
    
    staff_totals = []
    grand_total = 0
    async for doc in db.tronc_statements.aggregate(pipeline):
        entry = {
            "staff_id": doc["_id"]["staff_id"],
            "staff_name": doc["_id"]["staff_name"],
            "total_gross": round(doc["total_gross"], 2),
            "distributions": doc["distribution_count"],
            "ni_exempt": is_independent_tronc,
            "paye_taxable": True  # Always taxable
        }
        staff_totals.append(entry)
        grand_total += doc["total_gross"]
    
    # Get source breakdown
    source_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": "distributed",
            "created_at": {"$gte": period_start, "$lte": period_end}
        }},
        {"$group": {
            "_id": "$source",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    by_source = {}
    async for doc in db.tronc_tips.aggregate(source_pipeline):
        by_source[doc["_id"]] = {"total": round(doc["total"], 2), "count": doc["count"]}
    
    return {
        "report_type": "hmrc_tronc_annual",
        "tax_year": tax_year,
        "period": {"start": "6 April " + str(start_year), "end": "5 April " + str(start_year + 1)},
        "business_id": business_id,
        "tronc_type": "independent" if is_independent_tronc else "employer_controlled",
        "ni_exemption": is_independent_tronc,
        "grand_total": round(grand_total, 2),
        "by_source": by_source,
        "staff_totals": staff_totals,
        "staff_count": len(staff_totals),
        "notes": [
            "All tips are subject to Income Tax via PAYE",
            "NI exemption applies only if distributed by an independent tronc master" if is_independent_tronc else "Employer-controlled distribution: subject to employer NI contributions",
            "Records must be retained for 3 years (Employment (Allocation of Tips) Act 2023)"
        ],
        "generated_at": datetime.utcnow().isoformat()
    }


# ─── Audit Trail ─── #

@router.get("/business/{business_id}/audit")
async def get_tronc_audit(business_id: str, tenant: TenantContext = Depends(verify_business_access), limit: int = 50):
    """Full audit trail — retained for 3 years per legal requirement."""
    db = get_database()
    
    entries = []
    async for doc in db.tronc_audit.find(
        {"business_id": business_id}
    ).sort("timestamp", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        entries.append(doc)
    
    return {"entries": entries}


# ─── Internal Distribution Calculator ─── #

async def _calculate_distribution(db, business_id: str, run: DistributionRun, preview: bool = True) -> dict:
    """
    Core distribution engine. Supports 5 methods:
    
    1. POINTS: Each role has point value. Staff earn points × hours worked.
       Pool divided by total points, each person gets their share.
    
    2. PERCENTAGE: Fixed % split between departments (e.g., 70% FOH / 30% kitchen).
       Within department, split equally or by hours.
    
    3. HOURS: Pure hours-based. Pool divided by total hours, each person gets hours × rate.
    
    4. EQUAL: Simple equal split among all eligible staff.
    
    5. HYBRID: Service charge → percentage split; card/cash tips → points split.
    """
    # Get policy
    policy = await db.tronc_policies.find_one({"business_id": business_id})
    if not policy:
        return {"error": "No tronc policy configured"}
    
    method = run.method_override or policy.get("distribution_method", "points")
    period_start = datetime.fromisoformat(run.period_start)
    period_end = datetime.fromisoformat(run.period_end + "T23:59:59")
    
    # Get pooled tips in period
    tips_query = {
        "business_id": business_id,
        "status": "pooled",
        "created_at": {"$gte": period_start, "$lte": period_end}
    }
    
    total_pool = 0
    tips_by_source = {}
    async for tip in db.tronc_tips.find(tips_query):
        total_pool += tip.get("amount", 0)
        src = tip.get("source", "unknown")
        tips_by_source[src] = tips_by_source.get(src, 0) + tip.get("amount", 0)
    
    if total_pool <= 0:
        return {"error": "No tips in pool for this period", "total_pool": 0}
    
    # Get eligible staff with hours worked
    eligible_staff = await _get_eligible_staff(db, business_id, policy, period_start, period_end)
    
    if not eligible_staff:
        return {"error": "No eligible staff for this period"}
    
    # Calculate allocations based on method
    allocations = []
    
    if method == "points":
        allocations = _calc_points(eligible_staff, total_pool, policy.get("points_by_role", {}))
    elif method == "percentage":
        allocations = _calc_percentage(eligible_staff, total_pool, policy.get("percentage_by_role", {}))
    elif method == "hours":
        allocations = _calc_hours(eligible_staff, total_pool)
    elif method == "equal":
        allocations = _calc_equal(eligible_staff, total_pool)
    elif method == "hybrid":
        allocations = _calc_hybrid(eligible_staff, tips_by_source, policy)
    
    # Round allocations and handle rounding remainder
    total_allocated = 0
    for alloc in allocations:
        alloc["amount"] = round(alloc["amount"], 2)
        total_allocated += alloc["amount"]
    
    # Distribute rounding penny to highest earner
    remainder = round(total_pool - total_allocated, 2)
    if remainder != 0 and allocations:
        allocations[0]["amount"] = round(allocations[0]["amount"] + remainder, 2)
    
    return {
        "preview": preview,
        "method": method,
        "period": {"start": run.period_start, "end": run.period_end},
        "total_pool": round(total_pool, 2),
        "tips_by_source": {k: round(v, 2) for k, v in tips_by_source.items()},
        "eligible_staff_count": len(eligible_staff),
        "allocations": sorted(allocations, key=lambda x: x["amount"], reverse=True),
        "total_allocated": round(sum(a["amount"] for a in allocations), 2)
    }


async def _get_eligible_staff(db, business_id, policy, period_start, period_end):
    """Get eligible staff with hours worked in the period."""
    eligible = []
    excluded_roles = set(policy.get("excluded_roles", []))
    eligible_roles = set(policy.get("eligible_roles", []))
    min_hours = policy.get("minimum_hours_threshold", 0)
    
    async for staff in db.staff.find({"business_id": business_id, "active": {"$ne": False}}):
        role = staff.get("role", "").lower()
        
        # Check role eligibility
        if excluded_roles and role in excluded_roles:
            continue
        if eligible_roles and role not in eligible_roles:
            continue
        
        # Calculate hours worked in period from clock records
        hours = 0
        async for record in db.clock_records.find({
            "business_id": business_id,
            "staff_id": str(staff["_id"]),
            "clock_in": {"$gte": period_start},
            "clock_out": {"$lte": period_end, "$exists": True}
        }):
            clock_in = record.get("clock_in")
            clock_out = record.get("clock_out")
            if clock_in and clock_out:
                duration = (clock_out - clock_in).total_seconds() / 3600
                # Subtract breaks
                for brk in record.get("breaks", []):
                    if brk.get("end"):
                        duration -= (brk["end"] - brk["start"]).total_seconds() / 3600
                hours += max(0, duration)
        
        # Also check scheduled shifts if no clock records
        if hours == 0:
            async for shift in db.shifts.find({
                "business_id": business_id,
                "staff_id": str(staff["_id"]),
                "start": {"$gte": period_start},
                "end": {"$lte": period_end},
                "status": {"$in": ["completed", "confirmed"]}
            }):
                shift_start = shift.get("start")
                shift_end = shift.get("end")
                if shift_start and shift_end:
                    hours += (shift_end - shift_start).total_seconds() / 3600
        
        if hours < min_hours:
            continue
        
        eligible.append({
            "staff_id": str(staff["_id"]),
            "staff_name": staff.get("name", "Unknown"),
            "role": role,
            "hours": round(hours, 2)
        })
    
    return eligible


def _calc_points(staff, total_pool, points_by_role):
    """Points-based distribution."""
    total_points = 0
    for s in staff:
        role_points = points_by_role.get(s["role"], 1)
        s["points"] = role_points * s["hours"]
        total_points += s["points"]
    
    if total_points == 0:
        return _calc_equal(staff, total_pool)
    
    rate_per_point = total_pool / total_points
    
    allocations = []
    for s in staff:
        allocations.append({
            "staff_id": s["staff_id"],
            "staff_name": s["staff_name"],
            "role": s["role"],
            "hours": s["hours"],
            "points": round(s["points"], 2),
            "amount": s["points"] * rate_per_point,
            "calculation_detail": {
                "role_points": points_by_role.get(s["role"], 1),
                "hours": s["hours"],
                "total_points": round(s["points"], 2),
                "rate_per_point": round(rate_per_point, 4)
            }
        })
    
    return allocations


def _calc_percentage(staff, total_pool, percentage_by_role):
    """Percentage-based distribution by department/role."""
    allocations = []
    
    # Group staff by role
    by_role = {}
    for s in staff:
        by_role.setdefault(s["role"], []).append(s)
    
    for role, pct in percentage_by_role.items():
        role_pool = total_pool * (pct / 100)
        role_staff = by_role.get(role, [])
        
        if not role_staff:
            continue
        
        # Within role, split by hours
        total_hours = sum(s["hours"] for s in role_staff)
        
        for s in role_staff:
            share = (s["hours"] / total_hours * role_pool) if total_hours > 0 else (role_pool / len(role_staff))
            allocations.append({
                "staff_id": s["staff_id"],
                "staff_name": s["staff_name"],
                "role": s["role"],
                "hours": s["hours"],
                "amount": share,
                "calculation_detail": {
                    "role_percentage": pct,
                    "role_pool": round(role_pool, 2),
                    "hours": s["hours"],
                    "role_total_hours": round(total_hours, 2)
                }
            })
    
    return allocations


def _calc_hours(staff, total_pool):
    """Pure hours-based distribution."""
    total_hours = sum(s["hours"] for s in staff)
    if total_hours == 0:
        return _calc_equal(staff, total_pool)
    
    rate = total_pool / total_hours
    return [{
        "staff_id": s["staff_id"],
        "staff_name": s["staff_name"],
        "role": s["role"],
        "hours": s["hours"],
        "amount": s["hours"] * rate,
        "calculation_detail": {"hours": s["hours"], "rate_per_hour": round(rate, 4)}
    } for s in staff]


def _calc_equal(staff, total_pool):
    """Equal split among all eligible staff."""
    per_person = total_pool / len(staff) if staff else 0
    return [{
        "staff_id": s["staff_id"],
        "staff_name": s["staff_name"],
        "role": s["role"],
        "hours": s["hours"],
        "amount": per_person,
        "calculation_detail": {"equal_share": round(per_person, 2), "eligible_count": len(staff)}
    } for s in staff]


def _calc_hybrid(staff, tips_by_source, policy):
    """Hybrid: service charge by percentage, tips by points."""
    service_charge = tips_by_source.get("service_charge", 0)
    other_tips = sum(v for k, v in tips_by_source.items() if k != "service_charge")
    
    allocations_map = {}
    
    # Service charge → percentage split
    if service_charge > 0 and policy.get("percentage_by_role"):
        pct_allocs = _calc_percentage(staff, service_charge, policy["percentage_by_role"])
        for a in pct_allocs:
            allocations_map[a["staff_id"]] = a
            a["amount_service_charge"] = a["amount"]
    
    # Other tips → points split
    if other_tips > 0 and policy.get("points_by_role"):
        pts_allocs = _calc_points(staff, other_tips, policy["points_by_role"])
        for a in pts_allocs:
            if a["staff_id"] in allocations_map:
                allocations_map[a["staff_id"]]["amount"] += a["amount"]
                allocations_map[a["staff_id"]]["amount_tips"] = a["amount"]
            else:
                a["amount_tips"] = a["amount"]
                allocations_map[a["staff_id"]] = a
    
    return list(allocations_map.values())
