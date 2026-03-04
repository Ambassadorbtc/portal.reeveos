"""
Seed Admin User
================
Creates admin user for james111trader@gmail.com
Run: python3 backend/scripts/seed_admin_user.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "james111trader@gmail.com"
ADMIN_PASSWORD = "reeveos2024"
ADMIN_NAME = "James"


async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    existing = await db.users.find_one({"email": ADMIN_EMAIL})

    if existing:
        # Update to admin role if not already
        if existing.get("role") != "admin":
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "role": "admin",
                    "password_hash": pwd_context.hash(ADMIN_PASSWORD),
                    "updated_at": datetime.utcnow(),
                }},
            )
            print(f"✅ Updated {ADMIN_EMAIL} → role: admin, password reset")
        else:
            # Just update password
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "password_hash": pwd_context.hash(ADMIN_PASSWORD),
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
            "role": "admin",
            "password_hash": pwd_context.hash(ADMIN_PASSWORD),
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
    print(f"   Role: admin")
    print(f"\n🔒 Change password after first login!")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
