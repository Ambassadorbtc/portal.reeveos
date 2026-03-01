"""
One-time password reset for peter.griffin8222@gmail.com
Runs on deploy, then the deploy script deletes this file.
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/rezvo")
DB_NAME = os.getenv("MONGODB_DB_NAME", "rezvo")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# The new temporary password — user should change immediately after login
TARGET_EMAIL = "peter.griffin8222@gmail.com"
TEMP_PASSWORD = "Rezvo2025!"


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    user = await db.users.find_one({"email": TARGET_EMAIL})
    if not user:
        print(f"❌ User {TARGET_EMAIL} not found")
        client.close()
        return

    new_hash = pwd_context.hash(TEMP_PASSWORD)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )

    print(f"✅ Password reset for {TARGET_EMAIL}")
    print(f"   Temporary password: {TEMP_PASSWORD}")
    print(f"   ⚠️  Change this immediately after login!")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
