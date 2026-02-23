"""One-time script to set up Coffee Haven enterprise account."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import settings

async def main():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]
    
    user = await db.users.find_one({"email": "adda@coffeehaven.com"})
    if not user:
        print("USER NOT FOUND")
        return
    
    print(f"Found: {user['name']} - {user['_id']}")
    
    # Check if business already exists
    if user.get("business_ids") and len(user["business_ids"]) > 0:
        bid = user["business_ids"][0]
        from bson import ObjectId
        try:
            await db.businesses.update_one(
                {"_id": ObjectId(bid)},
                {"$set": {"tier": "enterprise", "rezvo_tier": "enterprise"}}
            )
        except Exception:
            await db.businesses.update_one(
                {"_id": bid},
                {"$set": {"tier": "enterprise", "rezvo_tier": "enterprise"}}
            )
        print(f"Updated business {bid} to enterprise")
        return
    
    biz = {
        "name": "Coffee Haven",
        "type": "restaurant",
        "category": "cafe",
        "tier": "enterprise",
        "rezvo_tier": "enterprise",
        "owner_id": str(user["_id"]),
        "slug": "coffee-haven",
        "email": "adda@coffeehaven.com",
        "address": {"city": "Nottingham", "country": "UK"},
        "staff": [
            {"id": "staff-1", "name": "Manager", "role": "manager", "active": True},
            {"id": "staff-2", "name": "Barista 1", "role": "staff", "active": True},
        ],
        "booking_settings": {
            "slot_duration": 30,
            "opening_hours": {"open": "07:00", "close": "22:00"},
        },
        "features_enabled": [
            "calendar", "bookings", "staff", "services", "floor_plan",
            "tables", "analytics", "reviews", "crm", "marketing",
            "orders", "payments", "online_booking", "booking_link",
        ],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    r = await db.businesses.insert_one(biz)
    bid = str(r.inserted_id)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"business_ids": [bid], "role": "owner"}}
    )
    print(f"Created Coffee Haven ({bid}) - Enterprise tier. DONE.")

asyncio.run(main())
