"""
Fix peter.griffin8222@gmail.com to point at the ORIGINAL Micho business
with all the EPOS data, services, staff, menu etc.

Run: cd /opt/rezvo-app/backend && python3 scripts/fix_peter_micho.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

ORIGINAL_MICHO_BIZ = "699bdb20a2ccbc6589c1d0f8"  # 200 Crookes - has all data
EMPTY_MICHO_BIZ = "699c795624ab892476950012"       # Ecclesall Rd - empty shell
PETER_USER_ID = "699c795624ab892476950010"          # peter.griffin8222@gmail.com

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    # 1. Check what's in the original Micho business
    original = await db.businesses.find_one({"_id": ORIGINAL_MICHO_BIZ})
    empty = await db.businesses.find_one({"_id": EMPTY_MICHO_BIZ})
    
    if not original:
        # Try as ObjectId
        from bson import ObjectId
        original = await db.businesses.find_one({"_id": ObjectId(ORIGINAL_MICHO_BIZ)})
        empty = await db.businesses.find_one({"_id": ObjectId(EMPTY_MICHO_BIZ)})
    
    print("ORIGINAL Micho (699b...f8):")
    if original:
        print(f"  Name: {original.get('name')}")
        print(f"  Address: {original.get('address', original.get('city'))}")
        print(f"  Owner: {original.get('owner_id')}")
    else:
        print("  NOT FOUND")
    
    print(f"\nEMPTY Micho (699c...12):")
    if empty:
        print(f"  Name: {empty.get('name')}")
        print(f"  Address: {empty.get('address')}")
        print(f"  Owner: {empty.get('owner_id')}")
    else:
        print("  NOT FOUND")

    # 2. Count related data for each business
    for biz_id, label in [(ORIGINAL_MICHO_BIZ, "ORIGINAL"), (EMPTY_MICHO_BIZ, "EMPTY")]:
        print(f"\n  {label} business data:")
        for col_name in ["bookings", "reservations", "services", "staff", "menu_items", "menu_categories", "tables", "reviews", "orders"]:
            try:
                col = db[col_name]
                # Try both string and field variations
                count = 0
                for field in ["businessId", "business_id"]:
                    count += await col.count_documents({field: biz_id})
                if count > 0:
                    print(f"    {col_name}: {count}")
            except:
                pass

    # 3. Relink peter to original Micho
    print("\n--- FIXING ---")
    
    # Update peter's business_ids to point to original
    result = await db.users.update_one(
        {"_id": PETER_USER_ID},
        {"$set": {"business_ids": [ORIGINAL_MICHO_BIZ]}}
    )
    if not result.modified_count:
        from bson import ObjectId
        result = await db.users.update_one(
            {"_id": ObjectId(PETER_USER_ID)},
            {"$set": {"business_ids": [ORIGINAL_MICHO_BIZ]}}
        )
    print(f"  Updated peter's business_ids: modified={result.modified_count}")

    # Update original Micho's owner to peter
    result = await db.businesses.update_one(
        {"_id": ORIGINAL_MICHO_BIZ},
        {"$set": {"owner_id": PETER_USER_ID}}
    )
    if not result.modified_count:
        from bson import ObjectId
        result = await db.businesses.update_one(
            {"_id": ObjectId(ORIGINAL_MICHO_BIZ)},
            {"$set": {"owner_id": PETER_USER_ID}}
        )
    print(f"  Updated original Micho owner: modified={result.modified_count}")

    # Verify
    user = await db.users.find_one({"email": "peter.griffin8222@gmail.com"})
    print(f"\n  Peter now linked to: {user.get('business_ids')}")
    print(f"  ✅ Done — peter should now see original Micho with all data")

    client.close()

asyncio.run(main())
