from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from middleware.rate_limit import limiter
from database import get_database
from typing import Optional, List
from models.business import BusinessCategory

router = APIRouter(prefix="/directory", tags=["directory"])


@router.get("/search")
async def search_businesses(
    query: Optional[str] = None,
    category: Optional[BusinessCategory] = None,
    location: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = 10.0,
    min_rating: Optional[float] = None,
    price_level: Optional[int] = None,
    promoted_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    db = get_database()
    
    filters = {}
    
    if category:
        filters["category"] = category.value
    
    if query:
        filters["$or"] = [
            {"name": {"$regex": query, "$options": "i"}},
            {"address": {"$regex": query, "$options": "i"}},
            {"primary_type": {"$regex": query, "$options": "i"}}
        ]
    
    if location:
        location_doc = await db.locations.find_one({"slug": location})
        if location_doc:
            filters["location_id"] = str(location_doc["_id"])
    
    if min_rating:
        filters["rating"] = {"$gte": min_rating}
    
    if price_level:
        filters["price_level"] = price_level
    
    if promoted_only:
        filters["promoted"] = True
    
    total = await db.businesses.count_documents(filters)
    
    businesses = await db.businesses.find(filters).skip(skip).limit(limit).to_list(length=None)
    
    return {
        "total": total,
        "limit": limit,
        "skip": skip,
        "results": jsonable_encoder(businesses)
    }


@router.get("/categories/{category}")
async def get_category_businesses(
    category: BusinessCategory,
    location_slug: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    db = get_database()
    
    filters = {"category": category.value}
    
    if location_slug:
        location = await db.locations.find_one({"slug": location_slug})
        if location:
            filters["location_id"] = str(location["_id"])
    
    businesses = await db.businesses.find(filters).limit(limit).to_list(length=None)
    
    return jsonable_encoder(businesses)


@router.get("/locations")
async def get_locations(
    region: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
):
    db = get_database()
    
    filters = {}
    if region:
        filters["region"] = region
    
    locations = await db.locations.find(filters).limit(limit).to_list(length=None)
    
    return jsonable_encoder(locations)


@router.get("/locations/{location_slug}")
async def get_location(location_slug: str):
    db = get_database()
    
    location = await db.locations.find_one({"slug": location_slug})
    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found"
        )
    
    return jsonable_encoder(location)


@router.get("/featured")
async def get_featured_businesses(
    category: Optional[BusinessCategory] = None,
    limit: int = Query(10, ge=1, le=50)
):
    db = get_database()
    
    filters = {"promoted": True}
    if category:
        filters["category"] = category.value
    
    businesses = await db.businesses.find(filters).limit(limit).to_list(length=None)
    
    return jsonable_encoder(businesses)


@router.post("/notify/{business_id}")
@limiter.limit("5/minute")
async def notify_business(request: Request, business_id: str):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=404,
            detail="Business not found"
        )
    
    if business.get("claimed"):
        raise HTTPException(
            status_code=400,
            detail="Business already claimed"
        )
    
    await db.businesses.update_one(
        {"_id": business_id},
        {"$inc": {"notify_count": 1}}
    )
    
    return {"detail": "Notification recorded"}

@router.get("/home")
async def get_home_page():
    """Homepage data: trending, featured, categories summary"""
    db = get_database()
    
    # Get featured/promoted businesses
    trending = await db.businesses.find(
        {"$or": [{"promoted": True}, {"rating": {"$gte": 4.0}}]}
    ).sort("rating", -1).limit(12).to_list(length=None)
    
    # Get category counts
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    category_counts = await db.businesses.aggregate(pipeline).to_list(length=None)
    
    # Get location counts  
    loc_pipeline = [
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 12}
    ]
    location_counts = await db.businesses.aggregate(loc_pipeline).to_list(length=None)
    
    return {
        "trending": jsonable_encoder(trending),
        "categories": category_counts,
        "locations": location_counts
    }
