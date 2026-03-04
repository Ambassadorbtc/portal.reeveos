import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

MONGO_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

SET = "$" + "set"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    email = "peter.griffin8222@gmail.com"
    new_pw = "Rezvo2024!"

    count = await db.users.count_documents({"email": email})
    print(f"Found {count} user(s) with email {email}")

    async for u in db.users.find({"email": email}):
        print(f"  id={u['_id']} role={u.get('role')} name={u.get('name')}")

    new_hash = pwd.hash(new_pw)
    result = await db.users.update_many(
        {"email": email},
        {SET: {
            "password_hash": new_hash,
            "role": "platform_admin",
            "updated_at": datetime.utcnow(),
        }},
    )
    print(f"Updated {result.modified_count} doc(s)")

    user = await db.users.find_one({"email": email})
    if user:
        ok = pwd.verify(new_pw, user["password_hash"])
        print(f"Verify: {ok}")
        print(f"Role: {user.get('role')}")
    print(f"Login: {email} / {new_pw}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
