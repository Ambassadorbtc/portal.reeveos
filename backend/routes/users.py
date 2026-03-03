from fastapi import APIRouter, HTTPException, status, Depends
from database import get_database
from models.user import UserUpdate, UserResponse, UserRole
from middleware.auth import get_current_user
from datetime import datetime
from middleware.tenant import verify_business_access, set_user_tenant_context, TenantContext

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user.get("email", ""),
        name=current_user.get("name", "User"),
        phone=current_user.get("phone"),
        role=UserRole(current_user.get("role", "owner")),
        avatar=current_user.get("avatar"),
        saved_businesses=current_user.get("saved_businesses", []),
        business_ids=current_user.get("business_ids", []),
        stripe_connected=current_user.get("stripe_connected", False),
        created_at=current_user.get("created_at", datetime.utcnow())
    )


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    update_data = user_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        name=updated_user["name"],
        phone=updated_user.get("phone"),
        role=UserRole(updated_user["role"]),
        avatar=updated_user.get("avatar"),
        saved_businesses=updated_user.get("saved_businesses", []),
        business_ids=updated_user.get("business_ids", []),
        stripe_connected=updated_user.get("stripe_connected", False),
        created_at=updated_user["created_at"]
    )


@router.post("/me/save-business/{business_id}")
async def save_business(
    business_id: str,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    business = await db.businesses.find_one({"_id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"saved_businesses": business_id}}
    )
    
    return {"detail": "Business saved successfully"}


@router.delete("/me/save-business/{business_id}")
async def unsave_business(
    business_id: str,
    tenant: TenantContext = Depends(set_user_tenant_context),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"saved_businesses": business_id}}
    )
    
    return {"detail": "Business removed from saved"}


@router.get("/me/saved-businesses")
async def get_saved_businesses(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_user)):
    db = get_database()
    
    saved_ids = current_user.get("saved_businesses", [])
    if not saved_ids:
        return []
    
    businesses = await db.businesses.find({"_id": {"$in": saved_ids}}).to_list(length=None)
    
    return businesses


@router.get("/me/bookings")
async def get_user_bookings(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_user)):
    db = get_database()
    # Use bookings (Run 2) — match by customer email since bookings don't have user_id
    user_email = (current_user.get("email") or "").strip().lower()
    if not user_email:
        return []
    bookings = await db.bookings.find(
        {"customer.email": {"$regex": user_email, "$options": "i"}}
    ).sort("date", -1).sort("time", -1).limit(100).to_list(length=100)
    return bookings


@router.get("/me/reviews")
async def get_user_reviews(tenant: TenantContext = Depends(set_user_tenant_context), current_user: dict = Depends(get_current_user)):
    db = get_database()
    
    reviews = await db.reviews.find(
        {"user_id": str(current_user["_id"])}
    ).sort("created_at", -1).to_list(length=None)
    
    return reviews
