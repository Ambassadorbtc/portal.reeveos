"""
NUKE PETER FROM DATABASE
Removes peter.griffin8222@gmail.com user record entirely.
Updates Micho's staff array to replace Peter's email with James.
Run ONCE. Safe to re-run — checks existence first.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

PETER_EMAIL = "peter.griffin8222@gmail.com"
JAMES_EMAIL = "james111trader@gmail.com"
MICHO_ID = "699bdb20a2ccbc6589c1d0f8"

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    print("═══ NUKING PETER FROM DATABASE ═══\n")

    # 1. Delete Peter's user record
    peter = await db.users.find_one({"email": PETER_EMAIL})
    if peter:
        await db.users.delete_one({"_id": peter["_id"]})
        print(f"  ✅ Deleted user: {PETER_EMAIL} (id={peter['_id']})")
    else:
        print(f"  ✅ User {PETER_EMAIL} already gone")

    # 2. Update Micho's staff array — replace Peter's email with James
    from bson import ObjectId
    micho = await db.businesses.find_one({"_id": ObjectId(MICHO_ID)})
    if micho:
        staff = micho.get("staff", [])
        updated = False
        for member in staff:
            if member.get("email") == PETER_EMAIL:
                member["email"] = JAMES_EMAIL
                member["name"] = "James"
                updated = True
        if updated:
            await db.businesses.update_one(
                {"_id": ObjectId(MICHO_ID)},
                {"$set": {"staff": staff}}
            )
            print(f"  ✅ Updated Micho staff: Peter → James")
        else:
            # Check if Peter's email is anywhere in staff
            peter_in_staff = any(s.get("email") == PETER_EMAIL for s in staff)
            if not peter_in_staff:
                print(f"  ✅ Micho staff already clean (no Peter)")

    # 3. Update Micho owner_email if it references Peter
    if micho and micho.get("email") == PETER_EMAIL:
        await db.businesses.update_one(
            {"_id": ObjectId(MICHO_ID)},
            {"$set": {"email": JAMES_EMAIL}}
        )
        print(f"  ✅ Updated Micho business email → {JAMES_EMAIL}")
    
    if micho and micho.get("owner_email") == PETER_EMAIL:
        await db.businesses.update_one(
            {"_id": ObjectId(MICHO_ID)},
            {"$set": {"owner_email": JAMES_EMAIL}}
        )
        print(f"  ✅ Updated Micho owner_email → {JAMES_EMAIL}")

    # 4. Check for any other collections referencing Peter's email
    collections = await db.list_collection_names()
    for col_name in collections:
        if col_name in ("users",):  # already handled
            continue
        col = db[col_name]
        count = await col.count_documents({"$or": [
            {"email": PETER_EMAIL},
            {"customer.email": PETER_EMAIL},
            {"owner_email": PETER_EMAIL},
        ]})
        if count > 0:
            print(f"  ⚠️  {count} documents in '{col_name}' reference {PETER_EMAIL}")

    # 5. Verify James is properly linked
    james = await db.users.find_one({"email": JAMES_EMAIL})
    if james:
        biz_ids = [str(b) for b in james.get("business_ids", [])]
        print(f"\n  James status:")
        print(f"    id:           {james['_id']}")
        print(f"    role:         {james.get('role')}")
        print(f"    business_ids: {biz_ids}")
        print(f"    linked to Micho: {'✅' if MICHO_ID in biz_ids else '❌'}")
    else:
        print(f"\n  ❌ James not found! Run create_james.py first")

    # 6. Final check — any Peter anywhere?
    peter_check = await db.users.find_one({"email": PETER_EMAIL})
    print(f"\n  Peter in users collection: {'❌ STILL EXISTS' if peter_check else '✅ GONE'}")

    client.close()
    print("\n═══ DONE ═══")

asyncio.run(main())
