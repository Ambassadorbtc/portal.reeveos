"""
Fix all account passwords using bcrypt directly (bypasses passlib version bug).
Usage: cd /opt/rezvo-app/backend && python3 scripts/fix_passwords.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os

ACCOUNTS = [
    ("peter.griffin8222@gmail.com", "Rezvo2024!"),
    ("grantwoods@live.com", "Reeve@Grant2026"),
    ("ibbyonline@gmail.com", "Reeve@Micho2026"),
]

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    for email, password in ACCOUNTS:
        # Hash with bcrypt directly — no passlib involved
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        
        # Verify it works before writing
        if not bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8")):
            print(f"  ❌ {email} — hash verification failed, skipping")
            continue

        result = await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hashed}}
        )
        if result.modified_count:
            print(f"  ✅ {email} — password reset (verified)")
        else:
            user = await db.users.find_one({"email": email})
            if user:
                print(f"  ⚠️  {email} — exists but update returned 0 modified")
            else:
                print(f"  ❌ {email} — NOT FOUND")

    # Now verify all logins work using the SAME method auth.py uses
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    print("\n  --- Verification (via passlib, same as auth.py) ---")
    for email, password in ACCOUNTS:
        user = await db.users.find_one({"email": email})
        if not user:
            print(f"  ❌ {email} — not found")
            continue
        ph = user.get("password_hash", "")
        try:
            ok = pwd_context.verify(password, ph)
            print(f"  {'✅' if ok else '❌'} {email} — passlib verify: {'PASS' if ok else 'FAIL'}")
        except Exception as e:
            print(f"  ❌ {email} — passlib error: {e}")

    client.close()

asyncio.run(main())
