"""
DIAGNOSE PASSWORD STATE — reads only, never writes.
Shows exactly what's in the DB and why logins fail.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os

ACCOUNTS = [
    ("james111trader@gmail.com",     "Reeve@James2026"),
    ("grantwoods@live.com",         "Reeve@Grant2026"),
    ("ibbyonline@gmail.com",        "Reeve@Micho2026"),
    ("mo.jalloh@me.com",            "Reeve@Mo2026"),
    ("levelambassador@gmail.com",   "Reeve@Salon2026"),
]

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    print("═══ PASSWORD DIAGNOSIS (READ ONLY — no writes) ═══\n")
    for email, expected_password in ACCOUNTS:
        user = await db.users.find_one({"email": email})
        if not user:
            print(f"  ❌ {email} — USER NOT FOUND IN DB")
            continue

        stored_hash = user.get("password_hash", "")
        has_password_field = "password" in user  # old field name?
        has_hash_field = "password_hash" in user

        print(f"  {email}:")
        print(f"    has 'password_hash' field: {has_hash_field}")
        print(f"    has 'password' field:      {has_password_field}")
        
        if has_password_field and not has_hash_field:
            print(f"    ⚠️  WRONG FIELD NAME — stored under 'password' not 'password_hash'")
            stored_hash = user.get("password", "")

        if not stored_hash:
            print(f"    ❌ NO HASH STORED")
            continue

        print(f"    hash prefix: {stored_hash[:20]}...")
        print(f"    hash length: {len(stored_hash)}")
        
        # Check if it's valid bcrypt format
        is_bcrypt = stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$")
        is_passlib = stored_hash.startswith("$pbkdf2") or stored_hash.startswith("$argon2")
        print(f"    format: {'bcrypt' if is_bcrypt else 'passlib' if is_passlib else 'UNKNOWN'}")

        # Try to verify
        if is_bcrypt:
            try:
                matches = bcrypt.checkpw(
                    expected_password.encode("utf-8"),
                    stored_hash.encode("utf-8")
                )
                print(f"    password correct: {'✅ YES' if matches else '❌ NO — hash does not match expected password'}")
            except Exception as e:
                print(f"    ❌ bcrypt.checkpw CRASHED: {e}")
        elif is_passlib:
            print(f"    ❌ PASSLIB HASH — auth.py uses raw bcrypt, cannot verify passlib hashes")
            print(f"    THIS IS THE ROOT CAUSE — hash was written by old passlib code")
        else:
            print(f"    ❌ UNKNOWN HASH FORMAT — cannot verify")

        print()

    client.close()

asyncio.run(main())
