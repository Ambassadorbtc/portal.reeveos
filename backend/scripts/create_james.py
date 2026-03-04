"""
Create james111trader@gmail.com as Micho business owner.
Run ONCE on VPS. Safe to re-run — checks for existing account first.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from datetime import datetime
from bson import ObjectId

JAMES_EMAIL = "james111trader@gmail.com"
JAMES_PASSWORD = "Reeve@James2026"
JAMES_NAME = "James"
MICHO_ID = "699bdb20a2ccbc6589c1d0f8"

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    # Check if already exists
    existing = await db.users.find_one({"email": JAMES_EMAIL})
    if existing:
        print(f"  ⚠️  {JAMES_EMAIL} already exists (id={existing['_id']})")
        # Make sure it's linked to Micho
        biz_ids = [str(b) for b in existing.get("business_ids", [])]
        if MICHO_ID not in biz_ids:
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "business_ids": [MICHO_ID],
                    "business_id": MICHO_ID,
                    "role": "business_owner",
                }}
            )
            print(f"  ✅ Linked to Micho + set role=business_owner")
        else:
            print(f"  ✅ Already linked to Micho")
        
        # Verify password
        h = existing.get("password_hash", "")
        try:
            ok = bcrypt.checkpw(JAMES_PASSWORD.encode("utf-8"), h.encode("utf-8"))
        except Exception:
            ok = False
        if not ok:
            new_hash = bcrypt.hashpw(JAMES_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": new_hash}})
            print(f"  ✅ Password hash corrected")
        else:
            print(f"  ✅ Password already correct")
        
        client.close()
        return

    # Create fresh
    hashed = bcrypt.hashpw(JAMES_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    assert bcrypt.checkpw(JAMES_PASSWORD.encode("utf-8"), hashed.encode("utf-8")), "Hash verify failed!"

    user_doc = {
        "email": JAMES_EMAIL,
        "name": JAMES_NAME,
        "phone": None,
        "role": "business_owner",
        "password_hash": hashed,
        "avatar": None,
        "saved_businesses": [],
        "business_ids": [MICHO_ID],
        "business_id": MICHO_ID,
        "booking_history": [],
        "review_history": [],
        "stripe_connected": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.users.insert_one(user_doc)
    print(f"  ✅ Created {JAMES_EMAIL} (id={result.inserted_id})")
    print(f"     role=business_owner")
    print(f"     linked to Micho ({MICHO_ID})")
    print(f"     password=Reeve@James2026")

    # Verify round-trip: can we read it back and check password?
    check = await db.users.find_one({"_id": result.inserted_id})
    ok = bcrypt.checkpw(JAMES_PASSWORD.encode("utf-8"), check["password_hash"].encode("utf-8"))
    print(f"  ✅ Password round-trip: {'PASSED' if ok else 'FAILED'}")

    client.close()

asyncio.run(main())
