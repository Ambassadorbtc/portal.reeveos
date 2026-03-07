"""
Fix Rejuvenate bookings — add staffId from staff_name.
Run on VPS: cd /opt/rezvo-app && python3 backend/scripts/fix_rejuvenate_bookings.py
"""
import asyncio
import os, sys
from dotenv import load_dotenv
load_dotenv("/opt/rezvo-app/backend/.env")
sys.path.insert(0, "/opt/rezvo-app/backend")

BIZ_ID = "699bdb20a2ccbc6589c1d0f7"


async def fix():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    # 1. Get current staff from business document
    biz = await db.businesses.find_one({"_id": BIZ_ID})
    if not biz:
        from bson import ObjectId
        biz = await db.businesses.find_one({"_id": ObjectId(BIZ_ID)})
    if not biz:
        print("ERROR: Rejuvenate business not found")
        return

    staff = biz.get("staff", [])
    name_to_id = {}
    for s in staff:
        name_to_id[s["name"].lower()] = s["id"]
    print(f"Staff mapping: {name_to_id}")

    # 2. Find all Rejuvenate bookings without staffId
    cursor = db.bookings.find({"businessId": BIZ_ID})
    docs = await cursor.to_list(length=None)
    print(f"Total Rejuvenate bookings: {len(docs)}")

    fixed = 0
    for doc in docs:
        staff_name = doc.get("staff_name") or doc.get("staffName") or ""
        existing_staff_id = doc.get("staffId") or doc.get("staff_id") or ""

        # Skip if already has valid staffId matching a real staff member
        if existing_staff_id and existing_staff_id in [s["id"] for s in staff]:
            continue

        # Match by name
        matched_id = name_to_id.get(staff_name.lower())
        if not matched_id:
            # Try first name match
            for name, sid in name_to_id.items():
                if staff_name.lower().startswith(name.split()[0]) or name.startswith(staff_name.lower().split()[0] if staff_name else ""):
                    matched_id = sid
                    break

        if matched_id:
            # Also fix service field — should be dict not string
            svc = doc.get("service", "")
            updates = {"staffId": matched_id}
            if isinstance(svc, str) and svc:
                updates["service"] = {
                    "name": svc,
                    "duration": doc.get("duration", 60),
                    "price": doc.get("price", 0),
                }

            await db.bookings.update_one(
                {"_id": doc["_id"]},
                {"$set": updates}
            )
            fixed += 1

    print(f"Fixed {fixed} bookings with staffId + service format")

    # 3. Quick count check
    with_staff = await db.bookings.count_documents({"businessId": BIZ_ID, "staffId": {"$exists": True, "$ne": ""}})
    without_staff = await db.bookings.count_documents({"businessId": BIZ_ID, "$or": [{"staffId": {"$exists": False}}, {"staffId": ""}]})
    print(f"With staffId: {with_staff}, Without: {without_staff}")


asyncio.run(fix())
