"""
ONE SCRIPT TO FIX EVERYTHING. Safe to run multiple times.
cd /opt/rezvo-app && python3 backend/scripts/fix_everything.py

Standards enforced:
  - Roles: super_admin, platform_admin, business_owner, staff, diner (NEVER 'owner')
  - Business type: always set (mirrors category if missing)
  - Test/junk businesses: deleted
  - Passwords: direct bcrypt (no passlib)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from datetime import datetime
from bson import ObjectId

# ─── ACCOUNT REGISTRY (single source of truth) ───────────────────
ACCOUNTS = [
    # email, password, expected_role
    ("peter.griffin8222@gmail.com",  "Rezvo2024!",        "business_owner"),
    ("grantwoods@live.com",         "Reeve@Grant2026",   "platform_admin"),
    ("ibbyonline@gmail.com",        "Reeve@Micho2026",   "super_admin"),
    ("mo.jalloh@me.com",            "Reeve@Mo2026",      "super_admin"),
    ("levelambassador@gmail.com",   "Reeve@Salon2026",   "business_owner"),
]

# Valid roles — anything else gets corrected
VALID_ROLES = {"super_admin", "platform_admin", "business_owner", "staff", "diner"}

# Role corrections: old → correct
ROLE_FIXES = {"owner": "business_owner", "admin": "platform_admin"}

ORIGINAL_MICHO = "699bdb20a2ccbc6589c1d0f8"


async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    # ═══════════════════════════════════════════════════════════════
    # 1. PASSWORDS — direct bcrypt, verify round-trip before writing
    # ═══════════════════════════════════════════════════════════════
    print("═══ 1. FIX PASSWORDS (direct bcrypt, no passlib) ═══")
    for email, password, expected_role in ACCOUNTS:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        assert bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

        user = await db.users.find_one({"email": email})
        if not user:
            if expected_role in ("super_admin", "platform_admin"):
                name_map = {
                    "ibbyonline@gmail.com": "Ambassador",
                    "mo.jalloh@me.com": "Mo Jalloh",
                    "grantwoods@live.com": "Grant Woods",
                }
                await db.users.insert_one({
                    "email": email, "name": name_map.get(email, email.split("@")[0]),
                    "role": expected_role, "password_hash": hashed,
                    "phone": None, "avatar": None,
                    "saved_businesses": [], "business_ids": [], "booking_history": [],
                    "review_history": [], "stripe_connected": False,
                    "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
                })
                print(f"  ✅ {email} — CREATED as {expected_role}")
            else:
                print(f"  ❌ {email} — NOT FOUND (business_owner accounts must exist)")
            continue

        await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hashed}})
        user2 = await db.users.find_one({"_id": user["_id"]})
        ok = bcrypt.checkpw(password.encode("utf-8"), user2["password_hash"].encode("utf-8"))
        print(f"  {'✅' if ok else '❌'} {email} — {'verified' if ok else 'FAILED'}")

    # ═══════════════════════════════════════════════════════════════
    # 2. ROLE STANDARDISATION — no more 'owner', enforce registry
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 2. FIX ROLES (standard: business_owner, never 'owner') ═══")
    
    # Fix registered accounts to their expected roles
    for email, _, expected_role in ACCOUNTS:
        user = await db.users.find_one({"email": email})
        if user and user.get("role") != expected_role:
            old = user.get("role")
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"role": expected_role}})
            print(f"  ✅ {email}: {old} → {expected_role}")
        elif user:
            print(f"  ✅ {email}: already {expected_role}")

    # Fix ALL users with invalid roles
    all_users = await db.users.find({}).to_list(None)
    for u in all_users:
        role = u.get("role", "")
        if role in ROLE_FIXES:
            new_role = ROLE_FIXES[role]
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"role": new_role}})
            print(f"  ✅ {u.get('email')}: {role} → {new_role}")
        elif role not in VALID_ROLES:
            print(f"  ⚠️  {u.get('email')}: unknown role '{role}' — review manually")

    # ═══════════════════════════════════════════════════════════════
    # 3. PETER → ORIGINAL MICHO
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 3. FIX PETER → ORIGINAL MICHO ═══")
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

    # ═══════════════════════════════════════════════════════════════
    # 4. BUSINESS TYPE CONSISTENCY — type must always be set
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 4. FIX BUSINESS TYPES (type must match category) ═══")
    
    # Micho specifically
    micho = await db.businesses.find_one({"_id": ObjectId(ORIGINAL_MICHO)})
    if micho:
        updates = {}
        if micho.get("type") != "restaurant": updates["type"] = "restaurant"
        if micho.get("category") != "restaurant": updates["category"] = "restaurant"
        if updates:
            await db.businesses.update_one({"_id": ObjectId(ORIGINAL_MICHO)}, {"$set": updates})
            print(f"  ✅ Micho: set {updates}")
        else:
            print(f"  ✅ Micho: type=restaurant, category=restaurant")
        print(f"     {micho.get('name')} — {micho.get('address', micho.get('city', ''))}")

    # All businesses: if type is missing but category exists, copy it
    all_biz = await db.businesses.find({}).to_list(None)
    for b in all_biz:
        btype = b.get("type")
        bcat = b.get("category")
        if not btype and bcat:
            await db.businesses.update_one({"_id": b["_id"]}, {"$set": {"type": bcat}})
            print(f"  ✅ {b.get('name')}: type={bcat} (copied from category)")
        elif not btype and not bcat:
            print(f"  ⚠️  {b.get('name')}: NO type or category — review manually")

    # ═══════════════════════════════════════════════════════════════
    # 5. CLEAN UP TEST/JUNK BUSINESSES
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 5. CLEAN UP TEST BUSINESSES ═══")
    junk = await db.businesses.find({"name": {"$regex": "^Rej Test|^Test Business$", "$options": "i"}}).to_list(None)
    if junk:
        ids = [j["_id"] for j in junk]
        result = await db.businesses.delete_many({"_id": {"$in": ids}})
        print(f"  ✅ Deleted {result.deleted_count} test businesses:")
        for j in junk:
            print(f"     - {j.get('name')}")
        # Also remove these IDs from any user's business_ids
        for j in junk:
            jid = str(j["_id"])
            await db.users.update_many(
                {"business_ids": jid},
                {"$pull": {"business_ids": jid}}
            )
    else:
        print("  ✅ No test businesses found")

    # ═══════════════════════════════════════════════════════════════
    # 6. CLEAN UP TEST ACCOUNTS
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 6. CLEAN UP TEST ACCOUNTS ═══")
    test_emails = ["attacker@test.com", "test@test.com"]
    deleted = await db.users.delete_many({"email": {"$in": test_emails}})
    if deleted.deleted_count:
        print(f"  ✅ Deleted {deleted.deleted_count} test accounts")
    else:
        print("  ✅ No test accounts found")

    # Also fix any remaining 'owner' or 'admin' role users
    fixed_roles = await db.users.update_many({"role": "owner"}, {"$set": {"role": "business_owner"}})
    if fixed_roles.modified_count:
        print(f"  ✅ Fixed {fixed_roles.modified_count} users with legacy 'owner' role")
    fixed_admin = await db.users.update_many({"role": "admin"}, {"$set": {"role": "platform_admin"}})
    if fixed_admin.modified_count:
        print(f"  ✅ Fixed {fixed_admin.modified_count} users with legacy 'admin' role")

    print("\n═══ DONE ═══")
    client.close()

asyncio.run(main())
