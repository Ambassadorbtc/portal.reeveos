from fastapi import APIRouter, HTTPException, status, Depends, Body
from database import get_database
from models.business import BusinessCreate, BusinessUpdate, BusinessResponse, PlatformTier
from middleware.auth import get_current_owner, get_current_user
from datetime import datetime
from bson import ObjectId
from typing import List
import re
from middleware.tenant import verify_business_access, set_user_tenant_context, TenantContext

router = APIRouter(prefix="/businesses", tags=["businesses"])


async def _find_business(db, business_id: str):
    """Find business by ID, handling both ObjectId and string formats."""
    try:
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        biz = None
    if not biz:
        biz = await db.businesses.find_one({"_id": business_id})
    return biz


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_business(
    business_data: dict = Body(...),
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    # Allow diner, business_owner, platform_admin, super_admin to create businesses
    if current_user["role"] not in ("diner", "business_owner", "platform_admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    db = get_database()
    
    name = (business_data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Business name is required")
    category = business_data.get("category", "other")
    address = business_data.get("address", "")

    slug = slugify(name)
    
    existing = await db.businesses.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{int(datetime.utcnow().timestamp())}"
    
    # Map frontend tier names to backend tier
    tier_map = {"free": "solo", "starter": "team", "growth": "venue", "scale": "venue"}
    raw_tier = business_data.get("tier", "solo")
    tier = tier_map.get(raw_tier, raw_tier)
    
    # Build full address
    city = business_data.get("city", "")
    postcode = business_data.get("postcode", "")
    full_address = ", ".join(filter(None, [address, city, postcode]))

    business_dict = {
        "name": name,
        "category": category,
        "address": address,
        "city": city,
        "postcode": postcode,
        "full_address": full_address,
        "phone": business_data.get("phone", ""),
        "email": business_data.get("email", ""),
        "website": business_data.get("website"),
        "lat": 0.0,
        "lng": 0.0,
        "tier": tier,
        "slug": slug,
        "claimed": True,
        "owner_id": str(current_user["_id"]),
        "rezvo_tier": "free",
        "promoted": False,
        "notify_count": 0,
        "rating": None,
        "review_count": 0,
        "photo_refs": [],
        "staff": [],
        "menu": [],
        "custom_photos": [],
        "opening_hours": business_data.get("opening_hours", {}),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await db.businesses.insert_one(business_dict)
    business_id = str(result.inserted_id)
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"business_ids": business_id}}
    )

    # Upgrade diner → business_owner on first business creation (onboarding flow)
    if current_user.get("role") == "diner":
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"role": "business_owner"}}
        )
    
    business_dict["_id"] = business_id

    # Send welcome email
    try:
        import asyncio
        from helpers.email import send_welcome_business
        owner_email = current_user.get("email")
        owner_name = current_user.get("name", "there")
        if owner_email:
            asyncio.ensure_future(send_welcome_business(
                to=owner_email,
                owner_name=owner_name,
                business_name=business_dict["name"],
            ))
    except Exception:
        pass  # Don't block business creation if email fails

    return {
        "id": business_id,
        "name": business_dict["name"],
        "slug": business_dict["slug"],
        "category": business_dict["category"],
        "address": business_dict["address"],
        "phone": business_dict.get("phone"),
        "tier": business_dict.get("tier", "solo"),
        "claimed": True,
    }


@router.get("/{business_id}")
async def get_business(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    db = get_database()
    
    business = await _find_business(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    # Normalize address — could be string or dict
    addr = business.get("address", "")
    if isinstance(addr, dict):
        addr_str = ", ".join(filter(None, [addr.get("line1"), addr.get("city"), addr.get("postcode")]))
        lat = addr.get("lat", 0)
        lng = addr.get("lng", 0)
    else:
        addr_str = addr
        lat = business.get("lat", 0)
        lng = business.get("lng", 0)

    return {
        "id": str(business["_id"]),
        "name": business.get("name", ""),
        "slug": business.get("slug", ""),
        "type": business.get("type", "services"),
        "category": business.get("category", ""),
        "address": addr_str,
        "phone": business.get("phone"),
        "email": business.get("email"),
        "website": business.get("website"),
        "description": business.get("description"),
        "lat": lat,
        "lng": lng,
        "rating": business.get("rating"),
        "review_count": business.get("review_count", 0),
        "price_level": business.get("price_level"),
        "photo_refs": business.get("photo_refs", []),
        "claimed": business.get("claimed", False),
        "owner_id": str(business.get("owner_id", "")),
        "rezvo_tier": business.get("rezvo_tier", "free"),
        "tier": business.get("tier", "solo"),
        "promoted": business.get("promoted", False),
        "opening_hours": business.get("opening_hours"),
        "booking_settings": business.get("booking_settings"),
        "staff": business.get("staff", []),
        "tables": business.get("tables", []),
        "features_enabled": business.get("features_enabled", []),
        "stripe_connected": business.get("stripe_connected", False),
    }


@router.patch("/{business_id}", response_model=BusinessResponse)
async def update_business(
    business_id: str,
    business_update: BusinessUpdate,
    tenant: TenantContext = Depends(verify_business_access),
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    
    business = await _find_business(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if not (str(business.get("owner_id","")) == str(current_user["_id"]) or current_user.get("role") in ("business_owner","platform_admin","super_admin")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this business"
        )
    
    update_data = business_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": update_data}
    )
    
    updated_business = await _find_business(db, business_id)
    
    return BusinessResponse(
        id=str(updated_business["_id"]),
        name=updated_business["name"],
        slug=updated_business["slug"],
        category=updated_business["category"],
        address=updated_business["address"],
        phone=updated_business.get("phone"),
        website=updated_business.get("website"),
        lat=updated_business["lat"],
        lng=updated_business["lng"],
        rating=updated_business.get("rating"),
        review_count=updated_business["review_count"],
        price_level=updated_business.get("price_level"),
        photo_refs=updated_business.get("photo_refs", []),
        claimed=updated_business["claimed"],
        rezvo_tier=PlatformTier(updated_business["rezvo_tier"]),
        tier=updated_business.get("tier"),
        promoted=updated_business.get("promoted", False),
        opening_hours=updated_business.get("opening_hours")
    )


@router.delete("/{business_id}")
async def delete_business(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    
    business = await _find_business(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if not (str(business.get("owner_id","")) == str(current_user["_id"]) or current_user.get("role") in ("business_owner","platform_admin","super_admin")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this business"
        )
    
    await db.businesses.delete_one({"_id": business_id})
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"business_ids": business_id}}
    )
    
    return {"detail": "Business deleted successfully"}


@router.post("/{business_id}/claim")
async def claim_business(
    business_id: str,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_owner)
):
    db = get_database()
    
    business = await _find_business(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business.get("claimed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business already claimed"
        )
    
    await db.businesses.update_one(
        {"_id": business_id},
        {
            "$set": {
                "claimed": True,
                "owner_id": str(current_user["_id"]),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"business_ids": business_id}}
    )
    
    return {"detail": "Business claimed successfully"}


@router.get("/owner/my-businesses")
async def get_my_businesses(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_owner)):
    db = get_database()
    
    businesses = await db.businesses.find(
        {"owner_id": str(current_user["_id"])}
    ).to_list(length=None)
    
    return businesses
