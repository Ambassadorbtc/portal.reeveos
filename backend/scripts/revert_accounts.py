"""
REVERT ALL ACCOUNT CHANGES
- Undo the swap: rename ibbyonline back to peter.griffin8222
- Delete any duplicate peter.griffin accounts
- Delete the Grant admin account (will re-add properly later)
- Show what businesses are linked so we can debug the Rejuvenate issue

Run: cd /opt/rezvo-app && python3 backend/scripts/revert_accounts.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

MONGO_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    SET = chr(36) + "set"

    print("=== CURRENT STATE ===")

    # Show ALL users
    print("\nAll users in database:")
    async for u in db.users.find():
        print(f"  id={u['_id']} email={u.get('email')} role={u.get('role')} name={u.get('name')} biz={u.get('business_ids', [])}")

    print("\nAll businesses in database:")
    async for b in db.businesses.find():
        print(f"  id={b['_id']} name={b.get('name')} type={b.get('type')} slug={b.get('slug')}")

    print("\n=== REVERTING ===")

    # Step 1: Delete ALL peter.griffin accounts (the new empty ones)
    result = await db.users.delete_many({"email": "peter.griffin8222@gmail.com"})
    print(f"[1] Deleted {result.deleted_count} peter.griffin account(s)")

    # Step 2: Find ibbyonline (this is the ORIGINAL peter.griffin with all data)
    ibby = await db.users.find_one({"email": "ibbyonline@gmail.com"})
    if ibby:
        await db.users.update_one(
            {"_id": ibby["_id"]},
            {SET: {
                "email": "peter.griffin8222@gmail.com",
                "password_hash": pwd.hash("Rezvo2024!"),
                "updated_at": datetime.utcnow(),
            }},
        )
        print(f"[2] Renamed ibbyonline -> peter.griffin8222 (id={ibby['_id']} preserved)")
        print(f"    role: {ibby.get('role')}")
        print(f"    name: {ibby.get('name')}")
        print(f"    business_ids: {ibby.get('business_ids', [])}")

        # Show linked businesses
        for bid in ibby.get("business_ids", []):
            from bson import ObjectId
            biz = await db.businesses.find_one({"_id": ObjectId(bid) if isinstance(bid, str) else bid})
            if biz:
                print(f"    -> Business: {biz.get('name')} (type={biz.get('type')}) id={biz['_id']}")
            else:
                print(f"    -> Business {bid} NOT FOUND in DB")
    else:
        print("[2] No ibbyonline found - checking if peter.griffin still exists")
        peter = await db.users.find_one({"email": "peter.griffin8222@gmail.com"})
        if peter:
            print(f"    peter.griffin exists: id={peter['_id']} biz={peter.get('business_ids', [])}")
        else:
            print("    WARNING: Neither account found!")

    print("\n=== FINAL STATE ===")
    async for u in db.users.find():
        print(f"  id={u['_id']} email={u.get('email')} role={u.get('role')} name={u.get('name')} biz={u.get('business_ids', [])}")

    print("\nDone! Restart: sudo systemctl restart rezvo-app")
    print("Login: peter.griffin8222@gmail.com / Rezvo2024!")

    client.close()

if __name__ == "__main__":
    asyncio.run(main())
