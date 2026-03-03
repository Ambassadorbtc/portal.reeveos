"""
Create ibbyonline@gmail.com as platform_admin.
Usage: cd /opt/rezvo-app/backend && python3 scripts/create_ibby_admin.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from datetime import datetime

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    email = "ibbyonline@gmail.com"
    password = "Reeve@Micho2026"
    
    # Check if already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"  User {email} already exists (id={existing['_id']}, role={existing.get('role')})")
        print(f"  Updating to platform_admin and resetting password...")
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        await db.users.update_one(
            {"email": email},
            {"$set": {"role": "platform_admin", "password_hash": hashed}}
        )
        print(f"  ✅ Updated — role=platform_admin, password reset")
    else:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user_doc = {
            "email": email,
            "name": "Ambassador",
            "role": "platform_admin",
            "password_hash": hashed,
            "phone": None,
            "avatar": None,
            "saved_businesses": [],
            "business_ids": [],
            "booking_history": [],
            "review_history": [],
            "stripe_connected": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await db.users.insert_one(user_doc)
        print(f"  ✅ Created {email}")
        print(f"     ID:   {result.inserted_id}")
        print(f"     Role: platform_admin")
        print(f"     Pass: {password}")

    # Verify login works
    user = await db.users.find_one({"email": email})
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    ok = pwd_context.verify(password, user["password_hash"])
    print(f"  Login verify: {'✅ PASS' if ok else '❌ FAIL'}")

    client.close()

asyncio.run(main())
