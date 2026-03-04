"""
ReeveOS Admin Setup
Ensures admin account exists with full enterprise access.
Safe to run multiple times — only updates, never duplicates.
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import bcrypt as _bcrypt

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/rezvo")
DB_NAME = os.getenv("MONGODB_DB_NAME", "rezvo")


# ── Admin account (from environment — NEVER hardcode credentials) ──
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "levelambassador@gmail.com")
ADMIN_NAME = os.getenv("ADMIN_NAME", "ReeveOS Admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    import secrets
    ADMIN_PASSWORD = secrets.token_urlsafe(20)
    print(f"⚠️  No ADMIN_PASSWORD env var set. Generated temporary: {ADMIN_PASSWORD}")
    print(f"   Set ADMIN_PASSWORD in your .env to persist this.")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("🔧 ReeveOS Admin Setup")
    print("=" * 50)

    # ── 1. Ensure admin user exists ──
    user = await db.users.find_one({"email": ADMIN_EMAIL})

    if not user:
        print(f"  Creating admin user: {ADMIN_EMAIL}")
        user_doc = {
            "name": ADMIN_NAME,
            "email": ADMIN_EMAIL,
            "password_hash": _bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8"),
            "role": "business_owner",
            "account_type": "business_owner",
            "business_ids": [],
            "saved_businesses": [],
            "phone": "",
            "avatar": None,
            "stripe_connected": False,
            "is_active": True,
            "email_verified": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        user = user_doc
        print(f"  ✅ Created user: {result.inserted_id}")
    else:
        print(f"  ✓ Admin user exists: {user['_id']}")
        # Ensure role is business_owner
        if user.get("role") not in ("business_owner", "super_admin", "platform_admin"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"role": "business_owner", "updated_at": datetime.utcnow()}}
            )
            print(f"  ✅ Updated role to business_owner")

    user_id = str(user["_id"])

    # ── 2. Ensure at least one business exists for this user ──
    business_ids = user.get("business_ids", [])
    has_business = False

    for bid in business_ids:
        try:
            biz = await db.businesses.find_one({"_id": ObjectId(bid)})
            if biz:
                has_business = True
                # Ensure enterprise tier
                updates = {}
                if biz.get("tier") != "enterprise":
                    updates["tier"] = "enterprise"
                if biz.get("rezvo_tier") != "enterprise":
                    updates["rezvo_tier"] = "enterprise"
                if updates:
                    updates["updated_at"] = datetime.utcnow()
                    await db.businesses.update_one({"_id": biz["_id"]}, {"$set": updates})
                    print(f"  ✅ Upgraded '{biz.get('name', bid)}' to enterprise tier")
                else:
                    print(f"  ✓ Business '{biz.get('name', bid)}' already enterprise")
                break
        except Exception:
            continue

    if not has_business:
        # Check if there are any businesses in DB that belong to this user's email
        existing_biz = await db.businesses.find_one({
            "$or": [
                {"owner_email": ADMIN_EMAIL},
                {"email": ADMIN_EMAIL},
                {"staff": {"$elemMatch": {"email": ADMIN_EMAIL, "role": "owner"}}},
            ]
        })

        if existing_biz:
            bid = str(existing_biz["_id"])
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$addToSet": {"business_ids": bid}}
            )
            await db.businesses.update_one(
                {"_id": existing_biz["_id"]},
                {"$set": {"tier": "enterprise", "rezvo_tier": "enterprise", "updated_at": datetime.utcnow()}}
            )
            print(f"  ✅ Linked existing business '{existing_biz.get('name')}' to admin account")
            has_business = True

    if not has_business:
        # Create a default business
        biz_doc = {
            "name": "ReeveOS Demo Restaurant",
            "slug": "reeveos-demo",
            "type": "restaurant",
            "category": "restaurant",
            "tier": "enterprise",
            "rezvo_tier": "enterprise",
            "claimed": True,
            "description": "ReeveOS platform demo restaurant with full enterprise features enabled.",
            "phone": "",
            "email": ADMIN_EMAIL,
            "address": {
                "line1": "High Street",
                "city": "Nottingham",
                "postcode": "NG1 1AA",
                "country": "UK",
            },
            "opening_hours": {
                "monday": {"open": "09:00", "close": "22:00"},
                "tuesday": {"open": "09:00", "close": "22:00"},
                "wednesday": {"open": "09:00", "close": "22:00"},
                "thursday": {"open": "09:00", "close": "22:00"},
                "friday": {"open": "09:00", "close": "23:00"},
                "saturday": {"open": "10:00", "close": "23:00"},
                "sunday": {"open": "10:00", "close": "21:00"},
            },
            "booking_settings": {
                "slot_duration": 30,
                "max_advance_days": 90,
                "cancellation_hours": 24,
                "deposit_required": False,
            },
            "features_enabled": [
                "calendar", "bookings", "staff", "services", "analytics",
                "reviews", "crm", "marketing", "payments", "online_booking",
                "booking_link", "deposits", "reminders", "waitlist",
                "floor_plan", "orders", "delivery",
            ],
            "staff": [
                {
                    "id": "admin-staff-1",
                    "name": ADMIN_NAME,
                    "role": "owner",
                    "email": ADMIN_EMAIL,
                    "color": "#1B4332",
                    "active": True,
                }
            ],
            "stripe_connected": False,
            "owner_id": user_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await db.businesses.insert_one(biz_doc)
        bid = str(result.inserted_id)
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$addToSet": {"business_ids": bid}}
        )
        print(f"  ✅ Created demo business: {bid}")

    # ── 3. Ensure all businesses for this user have enterprise tier ──
    user_refreshed = await db.users.find_one({"_id": user["_id"]})
    for bid in user_refreshed.get("business_ids", []):
        try:
            await db.businesses.update_one(
                {"_id": ObjectId(bid)},
                {"$set": {"tier": "enterprise", "rezvo_tier": "enterprise"}}
            )
        except Exception:
            pass

    # ── 4. Summary ──
    user_final = await db.users.find_one({"_id": user["_id"]})
    print()
    print("📋 Admin Account Summary")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print(f"  Role:     {user_final.get('role')}")
    print(f"  Businesses: {len(user_final.get('business_ids', []))}")
    for bid in user_final.get("business_ids", []):
        try:
            biz = await db.businesses.find_one({"_id": ObjectId(bid)})
            if biz:
                print(f"    → {biz['name']} ({biz.get('type', '?')}) — tier: {biz.get('tier', '?')}")
        except Exception:
            print(f"    → {bid} (lookup failed)")

    print()
    print("🌐 Login at: https://rezvo.app/dashboard")
    print("✅ Admin setup complete")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
