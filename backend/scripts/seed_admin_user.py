"""
Seed Admin User
================
Creates admin user for james111trader@gmail.com
Run: python3 backend/scripts/seed_admin_user.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt as _bcrypt
import os

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")


ADMIN_EMAIL = "james111trader@gmail.com"
ADMIN_PASSWORD = "reeveos2024"
ADMIN_NAME = "James"


async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    existing = await db.users.find_one({"email": ADMIN_EMAIL})

    if existing:
        # Update to super_admin role if not already
        if existing.get("role") != "super_admin":
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "role": "super_admin",
                    "password_hash": _bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8"),
                    "updated_at": datetime.utcnow(),
                }},
            )
            print(f"✅ Updated {ADMIN_EMAIL} → role: super_admin, password reset")
        else:
            # Just update password
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "password_hash": _bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8"),
                    "updated_at": datetime.utcnow(),
                }},
            )
            print(f"✅ Admin user exists — password updated")
        print(f"   ID: {existing['_id']}")
    else:
        result = await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "phone": "",
            "role": "super_admin",
            "password_hash": _bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8"),
            "avatar": None,
            "saved_businesses": [],
            "booking_history": [],
            "review_history": [],
            "business_ids": [],
            "stripe_connected": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        print(f"✅ Admin user created")
        print(f"   ID: {result.inserted_id}")

    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print(f"   Role: super_admin")
    print(f"\n🔒 Change password after first login!")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
