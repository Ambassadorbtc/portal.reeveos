"""
Diagnose Micho login issue. Run on VPS:
cd /opt/rezvo-app/backend && python3 scripts/check_micho.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    user = await db.users.find_one({"email": "peter.griffin8222@gmail.com"})
    if not user:
        print("❌ User peter.griffin8222@gmail.com NOT FOUND")
        # Check all users
        async for u in db.users.find({}, {"email": 1, "role": 1}):
            print(f"  - {u.get('email')} (role={u.get('role')})")
        return

    print(f"User found:")
    print(f"  _id:           {user['_id']}")
    print(f"  email:         {user.get('email')}")
    print(f"  role:          {user.get('role')}")
    print(f"  business_ids:  {user.get('business_ids')}")
    
    ph = user.get("password_hash", "")
    print(f"  password_hash: {ph[:20]}..." if ph else "  password_hash: MISSING!")
    
    if ph:
        test = pwd_context.verify("Rezvo2024!", ph)
        print(f"  Verify 'Rezvo2024!': {'✅ PASS' if test else '❌ FAIL'}")
    
    # Check if there's a duplicate
    count = await db.users.count_documents({"email": "peter.griffin8222@gmail.com"})
    print(f"  Duplicates: {count} accounts with this email")

    client.close()

asyncio.run(main())
