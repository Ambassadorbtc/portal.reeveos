from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import get_database
from models.review import ReviewCreate, ReviewUpdate, ReviewResponse
from middleware.auth import get_current_user, get_current_owner
from datetime import datetime
from typing import Optional
from middleware.tenant import verify_business_access, set_user_tenant_context, TenantContext

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": review_data.business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    existing_review = await db.reviews.find_one({
        "business_id": review_data.business_id,
        "user_id": str(current_user["_id"])
    })
    
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this business"
        )
    
    review_dict = review_data.model_dump()
    review_dict.update({
        "user_id": str(current_user["_id"]),
        "photos": [],
        "helpful_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    result = await db.reviews.insert_one(review_dict)
    review_id = str(result.inserted_id)
    
    reviews = await db.reviews.find({"business_id": review_data.business_id}).to_list(length=None)
    total_rating = sum(r["rating"] for r in reviews)
    avg_rating = total_rating / len(reviews) if reviews else 0
    
    await db.businesses.update_one(
        {"_id": review_data.business_id},
        {
            "$set": {
                "rating": round(avg_rating, 1),
                "review_count": len(reviews)
            }
        }
    )
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"review_history": review_id}}
    )
    
    review_dict["_id"] = review_id
    
    return ReviewResponse(
        id=review_id,
        business_id=review_dict["business_id"],
        user_id=review_dict["user_id"],
        rating=review_dict["rating"],
        body=review_dict.get("body"),
        categories=review_dict.get("categories"),
        photos=review_dict["photos"],
        helpful_count=review_dict["helpful_count"],
        created_at=review_dict["created_at"]
    )


@router.get("/business/{business_id}")
async def get_business_reviews(
    business_id: str,
    tenant: TenantContext = Depends(verify_business_access),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    min_rating: Optional[int] = None
):
    db = get_database()
    
    filters = {"business_id": business_id}
    if min_rating:
        filters["rating"] = {"$gte": min_rating}
    
    total = await db.reviews.count_documents(filters)
    
    reviews = await db.reviews.find(filters).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    
    for review in reviews:
        user = await db.users.find_one({"_id": review["user_id"]})
        if user:
            review["user_name"] = user["name"]
            review["user_avatar"] = user.get("avatar")
    
    return {
        "total": total,
        "limit": limit,
        "skip": skip,
        "results": reviews
    }


@router.patch("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: str,
    review_update: ReviewUpdate,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    review = await db.reviews.find_one({"_id": review_id})
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    if review["user_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this review"
        )
    
    update_data = review_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.reviews.update_one(
        {"_id": review_id},
        {"$set": update_data}
    )
    
    if "rating" in update_data:
        reviews = await db.reviews.find({"business_id": review["business_id"]}).to_list(length=None)
        total_rating = sum(r["rating"] for r in reviews)
        avg_rating = total_rating / len(reviews) if reviews else 0
        
        await db.businesses.update_one(
            {"_id": review["business_id"]},
            {"$set": {"rating": round(avg_rating, 1)}}
        )
    
    updated_review = await db.reviews.find_one({"_id": review_id})
    
    return ReviewResponse(
        id=str(updated_review["_id"]),
        business_id=updated_review["business_id"],
        user_id=updated_review["user_id"],
        rating=updated_review["rating"],
        body=updated_review.get("body"),
        categories=updated_review.get("categories"),
        photos=updated_review.get("photos", []),
        helpful_count=updated_review["helpful_count"],
        created_at=updated_review["created_at"]
    )


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    review = await db.reviews.find_one({"_id": review_id})
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    if review["user_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this review"
        )
    
    await db.reviews.delete_one({"_id": review_id})
    
    reviews = await db.reviews.find({"business_id": review["business_id"]}).to_list(length=None)
    total_rating = sum(r["rating"] for r in reviews)
    avg_rating = total_rating / len(reviews) if reviews else 0
    
    await db.businesses.update_one(
        {"_id": review["business_id"]},
        {
            "$set": {
                "rating": round(avg_rating, 1),
                "review_count": len(reviews)
            }
        }
    )
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"review_history": review_id}}
    )
    
    return {"detail": "Review deleted successfully"}


@router.post("/{review_id}/helpful")
async def mark_helpful(
    review_id: str,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    review = await db.reviews.find_one({"_id": review_id})
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    await db.reviews.update_one(
        {"_id": review_id},
        {"$inc": {"helpful_count": 1}}
    )
    
    return {"detail": "Marked as helpful"}


# ─── Owner Reply ─── #

@router.post("/{review_id}/reply")
async def reply_to_review(
    review_id: str,
    body: dict,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    """Business owner replies to a review."""
    db = get_database()
    review = await db.reviews.find_one({"_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    reply_text = body.get("reply", "").strip()
    if not reply_text:
        raise HTTPException(status_code=400, detail="Reply text is required")

    await db.reviews.update_one(
        {"_id": review_id},
        {"$set": {
            "owner_reply": reply_text,
            "owner_reply_at": datetime.utcnow(),
            "owner_reply_by": str(current_user.get("_id", "")),
            "updated_at": datetime.utcnow(),
        }}
    )
    return {"detail": "Reply saved", "reply": reply_text}
