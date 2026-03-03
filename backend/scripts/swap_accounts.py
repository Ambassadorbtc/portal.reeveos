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

    # 1 Delete the NEW empty ibbyonline account
    new_ibby = await db.users.find_one({"email": "ibbyonline@gmail.com"})
    if new_ibby:
        await db.users.delete_one({"_id": new_ibby["_id"]})
        print("[1] Deleted empty ibbyonline account")
    else:
        print("[1] No ibbyonline found - skip")

    # 2 Rename peter.griffin -> ibbyonline keeping ALL data + user ID
    peter = await db.users.find_one({"email": "peter.griffin8222@gmail.com"})
    if peter:
        await db.users.update_one(
            {"_id": peter["_id"]},
            {SET: {
                "email": "ibbyonline@gmail.com",
                "password_hash": pwd.hash("Reeve@Micho2026"),
                "role": "business_owner",
                "updated_at": datetime.utcnow(),
            }},
        )
        print("[2] peter.griffin -> ibbyonline (user ID preserved, all Micho data kept)")
    else:
        print("[2] ERROR: peter.griffin NOT FOUND")

    # 3 Create fresh peter.griffin for admin panel only
    result = await db.users.insert_one({
        "email": "peter.griffin8222@gmail.com",
        "name": "Admin",
        "phone": "",
        "role": "platform_admin",
        "password_hash": pwd.hash("Rezvo2024!"),
        "avatar": None,
        "saved_businesses": [],
        "booking_history": [],
        "review_history": [],
        "business_ids": [],
        "stripe_connected": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })
    print("[3] Fresh peter.griffin created for admin panel")
    print()
    print("Logins:")
    print("  Admin:  peter.griffin8222@gmail.com / Rezvo2024!")
    print("  Micho:  ibbyonline@gmail.com / Reeve@Micho2026")
    print("  Grant:  grantwoods@live.com / Reeve@Grant2026")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
