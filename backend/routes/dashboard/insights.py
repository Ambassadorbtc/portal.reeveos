"""
Business Insights Report API
- Generate SEO/Google/Facebook audit reports
- Unique expiring links (15 days)
- Email drip: initial → 10 days left → 5 days left → expired
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from models.insights_report import InsightsReport, slugify
from middleware.auth import get_current_owner
import database
import logging
from middleware.tenant import set_user_tenant_context, TenantContext

router = APIRouter(prefix="/insights", tags=["insights"])
logger = logging.getLogger(__name__)


# ─── Request/Response Models ─── #

class CreateReportRequest(BaseModel):
    business_name: str
    business_address: Optional[str] = None
    business_type: str = "restaurant"
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    google_place_id: Optional[str] = None
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    # Manual overrides (for when we have real data)
    website_url: Optional[str] = None
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    facebook_rating: Optional[float] = None
    on_deliveroo: bool = False
    on_ubereats: bool = False
    on_justeat: bool = False
    estimated_monthly_orders: Optional[int] = None
    avg_order_value: Optional[float] = None


class ReportSummary(BaseModel):
    business_name: str
    slug: str
    token: str
    overall_score: int
    overall_grade: str
    created_at: datetime
    expires_at: datetime
    view_count: int
    lead_status: str
    owner_email: Optional[str] = None
    report_url: str


class EmailDripStatus(BaseModel):
    business_name: str
    token: str
    emails_sent: List[str]
    next_email: Optional[str] = None
    next_email_date: Optional[datetime] = None
    days_remaining: int


# ─── Helpers ─── #

def get_collection():
    return database.db["insights_reports"]


def build_report_url(slug: str, token: str) -> str:
    return f"https://webportal.reeveos.app/insights/{slug}/{token}"


def estimate_commission_savings(
    on_deliveroo: bool,
    on_ubereats: bool,
    on_justeat: bool,
    monthly_orders: Optional[int] = None,
    avg_order: Optional[float] = None
) -> float:
    """Estimate how much a restaurant loses to commission annually"""
    platforms = sum([on_deliveroo, on_ubereats, on_justeat])
    if platforms == 0:
        return 0

    orders = monthly_orders or 200  # Conservative default
    avg = avg_order or 22.0  # UK average
    avg_commission = 0.30  # 30% average across platforms

    monthly_loss = orders * avg * avg_commission
    return round(monthly_loss * 12, 2)


# ─── Endpoints ─── #

@router.post("/reports", response_model=dict)
async def create_report(req: CreateReportRequest, tenant: TenantContext = Depends(set_user_tenant_context), _user=Depends(get_current_owner)):
    """Generate a new insights report for a business"""

    coll = get_collection()

    # Check for existing active report for this business
    existing = await coll.find_one({
        "slug": slugify(req.business_name),
        "is_expired": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })

    if existing:
        return {
            "message": "Active report already exists",
            "report_url": build_report_url(existing["slug"], existing["token"]),
            "token": existing["token"],
            "slug": existing["slug"],
            "expires_at": existing["expires_at"].isoformat()
        }

    # Build the report
    report = InsightsReport(
        business_name=req.business_name,
        business_address=req.business_address,
        business_type=req.business_type,
        business_phone=req.business_phone,
        business_email=req.business_email,
        google_place_id=req.google_place_id,
        owner_email=req.owner_email,
        owner_name=req.owner_name,
    )

    # Populate with provided data
    if req.website_url:
        report.website.has_website = True
        report.website.url = req.website_url
        # Default assumptions for manual entry — real crawler would fill these
        report.website.has_ssl = req.website_url.startswith("https")
        report.website.is_mobile_friendly = True  # Assume yes unless crawled
        report.website.load_speed_score = 60
        report.website.has_meta_description = True
        report.website.has_online_booking = False
        report.website.has_online_ordering = False

    if req.google_rating is not None:
        report.google.has_google_profile = True
        report.google.google_rating = req.google_rating
        report.google.google_review_count = req.google_review_count or 0
        report.google.has_booking_link = False
        report.google.responds_to_reviews = False
        report.google.google_photos_count = 5
        report.google.has_correct_hours = True

    if req.facebook_rating is not None:
        report.facebook.has_facebook_page = True
        report.facebook.facebook_rating = req.facebook_rating
        report.facebook.has_booking_button = False
        report.facebook.has_menu = False
        report.facebook.last_post_days_ago = 14

    # Ordering/delivery
    report.ordering.on_deliveroo = req.on_deliveroo
    report.ordering.on_ubereats = req.on_ubereats
    report.ordering.on_justeat = req.on_justeat
    report.ordering.has_own_ordering = False
    report.ordering.estimated_monthly_orders = req.estimated_monthly_orders
    if req.estimated_monthly_orders and req.avg_order_value:
        platforms = sum([req.on_deliveroo, req.on_ubereats, req.on_justeat])
        if platforms > 0:
            report.ordering.estimated_commission_lost = round(
                req.estimated_monthly_orders * req.avg_order_value * 0.30, 2
            )

    # Calculate all scores
    report.calculate_scores()

    # Estimate annual savings
    report.estimated_annual_commission_savings = estimate_commission_savings(
        req.on_deliveroo, req.on_ubereats, req.on_justeat,
        req.estimated_monthly_orders, req.avg_order_value
    )

    # Store in MongoDB
    doc = report.dict()
    await coll.insert_one(doc)

    report_url = build_report_url(report.slug, report.token)

    return {
        "message": "Report generated successfully",
        "report_url": report_url,
        "token": report.token,
        "slug": report.slug,
        "overall_score": report.overall_score,
        "overall_grade": report.overall_grade,
        "expires_at": report.expires_at.isoformat(),
        "expires_in_days": 15
    }


@router.get("/reports/{slug}/{token}")
async def view_report(slug: str, token: str):
    """View a report by slug and token (public endpoint for report links)"""

    coll = get_collection()
    report = await coll.find_one({"slug": slug, "token": token})

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Check expiry
    if report.get("expires_at") and report["expires_at"] < datetime.utcnow():
        # Update expired status
        await coll.update_one(
            {"_id": report["_id"]},
            {"$set": {"is_expired": True}}
        )
        raise HTTPException(
            status_code=410,
            detail={
                "message": "This report has expired",
                "business_name": report["business_name"],
                "expired_at": report["expires_at"].isoformat(),
                "cta": "Contact us at hello@reeveos.app to get a fresh report and discuss how ReeveOS can help your business."
            }
        )

    # Track view
    await coll.update_one(
        {"_id": report["_id"]},
        {
            "$set": {
                "last_viewed_at": datetime.utcnow(),
                "lead_status": "viewed" if report.get("lead_status") == "new" else report.get("lead_status")
            },
            "$inc": {"view_count": 1}
        }
    )

    # Remove MongoDB _id for JSON serialization
    report.pop("_id", None)

    # Add computed fields
    remaining = (report["expires_at"] - datetime.utcnow()).days
    report["days_remaining"] = max(remaining, 0)
    report["report_url"] = build_report_url(slug, token)

    return report


@router.get("/reports", response_model=List[ReportSummary])
async def list_reports(
    tenant: TenantContext = Depends(set_user_tenant_context),
    _user=Depends(get_current_owner),
    status: Optional[str] = None,
    expired: Optional[bool] = None,
    limit: int = 50
):
    """List all reports (admin endpoint)"""

    coll = get_collection()
    query = {}

    if status:
        query["lead_status"] = status
    if expired is not None:
        if expired:
            query["expires_at"] = {"$lt": datetime.utcnow()}
        else:
            query["expires_at"] = {"$gte": datetime.utcnow()}

    cursor = coll.find(query).sort("created_at", -1).limit(limit)
    reports = []

    async for doc in cursor:
        reports.append(ReportSummary(
            business_name=doc["business_name"],
            slug=doc["slug"],
            token=doc["token"],
            overall_score=doc.get("overall_score", 0),
            overall_grade=doc.get("overall_grade", "?"),
            created_at=doc["created_at"],
            expires_at=doc["expires_at"],
            view_count=doc.get("view_count", 0),
            lead_status=doc.get("lead_status", "new"),
            owner_email=doc.get("owner_email"),
            report_url=build_report_url(doc["slug"], doc["token"])
        ))

    return reports


@router.get("/reports/{slug}/{token}/drip-status", response_model=EmailDripStatus)
async def get_drip_status(slug: str, token: str):
    """Check email drip status for a report"""

    coll = get_collection()
    report = await coll.find_one({"slug": slug, "token": token})

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    emails_sent = report.get("emails_sent", [])
    created = report["created_at"]
    remaining = max((report["expires_at"] - datetime.utcnow()).days, 0)

    # Determine next email
    next_email = None
    next_date = None

    if "initial" not in emails_sent:
        next_email = "initial"
        next_date = created
    elif "10_day" not in emails_sent and remaining <= 10:
        next_email = "10_day"
        next_date = created + timedelta(days=5)
    elif "5_day" not in emails_sent and remaining <= 5:
        next_email = "5_day"
        next_date = created + timedelta(days=10)
    elif "expired" not in emails_sent and remaining <= 0:
        next_email = "expired"
        next_date = report["expires_at"]

    return EmailDripStatus(
        business_name=report["business_name"],
        token=token,
        emails_sent=emails_sent,
        next_email=next_email,
        next_email_date=next_date,
        days_remaining=remaining
    )


@router.post("/reports/{slug}/{token}/send-email/{email_type}")
async def mark_email_sent(slug: str, token: str, email_type: str):
    """Mark an email as sent in the drip sequence"""

    valid_types = ["initial", "10_day", "5_day", "expired"]
    if email_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid email type. Must be one of: {valid_types}")

    coll = get_collection()
    result = await coll.update_one(
        {"slug": slug, "token": token},
        {"$addToSet": {"emails_sent": email_type}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"message": f"Email '{email_type}' marked as sent", "email_type": email_type}


@router.delete("/reports/{slug}/{token}")
async def delete_report(slug: str, token: str):
    """Delete a report"""

    coll = get_collection()
    result = await coll.delete_one({"slug": slug, "token": token})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"message": "Report deleted"}


@router.post("/reports/{slug}/{token}/regenerate")
async def regenerate_report(slug: str, token: str):
    """Regenerate a report with fresh 15-day expiry"""

    coll = get_collection()
    report = await coll.find_one({"slug": slug, "token": token})

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    new_expiry = datetime.utcnow() + timedelta(days=15)

    await coll.update_one(
        {"_id": report["_id"]},
        {
            "$set": {
                "expires_at": new_expiry,
                "is_expired": False,
                "emails_sent": [],
                "view_count": 0,
                "lead_status": "new"
            }
        }
    )

    return {
        "message": "Report regenerated with fresh 15-day expiry",
        "report_url": build_report_url(slug, token),
        "expires_at": new_expiry.isoformat()
    }
