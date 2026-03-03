"""
ONE SCRIPT TO FIX EVERYTHING. Safe to run multiple times.
cd /opt/rezvo-app/backend && python3 scripts/fix_everything.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from datetime import datetime

ACCOUNTS = [
    ("peter.griffin8222@gmail.com", "Rezvo2024!"),
    ("grantwoods@live.com", "Reeve@Grant2026"),
    ("ibbyonline@gmail.com", "Reeve@Micho2026"),
]

ORIGINAL_MICHO = "699bdb20a2ccbc6589c1d0f8"

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    print("═══ 1. FIX PASSWORDS (direct bcrypt, no passlib) ═══")
    for email, password in ACCOUNTS:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        # Verify before writing
        assert bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        
        user = await db.users.find_one({"email": email})
        if not user:
            if email == "ibbyonline@gmail.com":
                await db.users.insert_one({
                    "email": email, "name": "Ambassador", "role": "platform_admin",
                    "password_hash": hashed, "phone": None, "avatar": None,
                    "saved_businesses": [], "business_ids": [], "booking_history": [],
                    "review_history": [], "stripe_connected": False,
                    "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
                })
                print(f"  ✅ {email} — CREATED as platform_admin")
            else:
                print(f"  ❌ {email} — NOT FOUND")
            continue
        
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hashed}})
        # Read back and verify
        user2 = await db.users.find_one({"_id": user["_id"]})
        ok = bcrypt.checkpw(password.encode("utf-8"), user2["password_hash"].encode("utf-8"))
        print(f"  {'✅' if ok else '❌'} {email} — {'verified' if ok else 'FAILED'}")

    print("\n═══ 2. FIX PETER → ORIGINAL MICHO ═══")
    peter = await db.users.find_one({"email": "peter.griffin8222@gmail.com"})
    if peter:
        current_biz = peter.get("business_ids", [])
        if ORIGINAL_MICHO not in [str(b) for b in current_biz]:
            await db.users.update_one(
                {"_id": peter["_id"]},
                {"$set": {"business_ids": [ORIGINAL_MICHO]}}
            )
            print(f"  ✅ Relinked peter → {ORIGINAL_MICHO}")
        else:
            print(f"  ✅ Already linked to original Micho")

    print("\n═══ 3. FIX MICHO BUSINESS TYPE ═══")
    from bson import ObjectId
    micho = await db.businesses.find_one({"_id": ObjectId(ORIGINAL_MICHO)})
    if micho:
        updates = {}
        if micho.get("type") != "restaurant":
            updates["type"] = "restaurant"
        if micho.get("category") != "restaurant":
            updates["category"] = "restaurant"
        if updates:
            await db.businesses.update_one({"_id": ObjectId(ORIGINAL_MICHO)}, {"$set": updates})
            print(f"  ✅ Set type=restaurant, category=restaurant")
        else:
            print(f"  ✅ Already type=restaurant")
        print(f"  Name: {micho.get('name')}")
        print(f"  Address: {micho.get('address', micho.get('city'))}")
    
    print("\n═══ 4. FIX ROLE CONSISTENCY ═══")
    # Ensure peter's role works with frontend
    if peter and peter.get("role") == "business_owner":
        print(f"  ⚠️  Peter role is 'business_owner' — frontend now supports this")
    
    print("\n═══ DONE ═══")
    client.close()

asyncio.run(main())
