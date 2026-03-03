"""
Fix all account passwords. Run once on VPS.
Usage: cd /opt/rezvo-app/backend && python3 scripts/fix_passwords.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCOUNTS = [
    ("peter.griffin8222@gmail.com", "Rezvo2024!"),
    ("grantwoods@live.com", "Reeve@Grant2026"),
    ("ibbyonline@gmail.com", "Reeve@Micho2026"),
]

async def main():
    import os
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    for email, password in ACCOUNTS:
        hashed = pwd_context.hash(password)
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hashed}}
        )
        if result.modified_count:
            print(f"  ✅ {email} — password reset")
        else:
            user = await db.users.find_one({"email": email})
            if user:
                print(f"  ⚠️  {email} — exists but no change (already correct?)")
            else:
                print(f"  ❌ {email} — NOT FOUND in database")

    client.close()

asyncio.run(main())
