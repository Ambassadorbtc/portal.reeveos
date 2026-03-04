"""
Add Grant Wood as Admin User
Run on server: cd /opt/rezvo-app && python3 backend/scripts/add_grant_admin.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

MONGO_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

GRANT_EMAIL = "grantwoods@live.com"
GRANT_PASSWORD = "Reeve@Grant2026"
GRANT_NAME = "Grant Wood"


async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    existing = await db.users.find_one({"email": GRANT_EMAIL})

    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "role": "platform_admin",
                "password_hash": pwd_context.hash(GRANT_PASSWORD),
                "name": GRANT_NAME,
                "updated_at": datetime.utcnow(),
            }},
        )
        print(f"Updated {GRANT_EMAIL} -> platform_admin")
    else:
        result = await db.users.insert_one({
            "email": GRANT_EMAIL,
            "name": GRANT_NAME,
            "phone": "",
            "role": "platform_admin",
            "password_hash": pwd_context.hash(GRANT_PASSWORD),
            "avatar": None,
            "saved_businesses": [],
            "booking_history": [],
            "review_history": [],
            "business_ids": [],
            "stripe_connected": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        print(f"Admin user created - ID: {result.inserted_id}")

    print(f"   Email: {GRANT_EMAIL}")
    print(f"   Password: {GRANT_PASSWORD}")
    print(f"   Role: platform_admin")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
