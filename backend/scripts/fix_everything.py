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
import os, sys
from datetime import datetime
from bson import ObjectId

# Add backend/ to path so we can import accounts_config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from accounts_config import get_system_accounts

# ─── ACCOUNT REGISTRY (reads from env vars via accounts_config) ──
ACCOUNTS = get_system_accounts()

# Valid roles — anything else gets corrected
VALID_ROLES = {"super_admin", "platform_admin", "business_owner", "staff", "diner"}

# Role corrections: old → correct
ROLE_FIXES = {"owner": "business_owner", "admin": "platform_admin"}

ORIGINAL_MICHO = "699bdb20a2ccbc6589c1d0f8"
ORIGINAL_REJUVENATE = "699bdb20a2ccbc6589c1d0f7"


async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    # ═══════════════════════════════════════════════════════════════
    # 1. PASSWORDS — direct bcrypt, verify round-trip before writing
    # ═══════════════════════════════════════════════════════════════
    print("═══ 1. FIX PASSWORDS (direct bcrypt, no passlib) ═══")
    for email, password, expected_role in ACCOUNTS:
        user = await db.users.find_one({"email": email})
        if not user:
            if expected_role in ("super_admin", "platform_admin"):
                name_map = {
                    "ibbyonline@gmail.com": "Ambassador",
                    "mo.jalloh@me.com": "Mo Jalloh",
                    "grantwoods@live.com": "Grant Woods",
                }
                hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
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

        # CHECK first — only rewrite if the existing hash doesn't match
        existing_hash = user.get("password_hash", "")
        already_correct = False
        if existing_hash:
            try:
                already_correct = bcrypt.checkpw(password.encode("utf-8"), existing_hash.encode("utf-8"))
            except Exception:
                pass

        if already_correct:
            print(f"  ✅ {email} — already correct (no write needed)")
        else:
            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            assert bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hashed}})
            print(f"  ⚠️  {email} — HASH WAS WRONG, rewrote it")

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
    # 3. JAMES → ORIGINAL MICHO
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 3. FIX JAMES → ORIGINAL MICHO ═══")
    james = await db.users.find_one({"email": "james111trader@gmail.com"})
    if james:
        current_biz = james.get("business_ids", [])
        stale_biz_id = james.get("business_id", "")
        needs_fix = False
        update_fields = {}

        # Fix business_ids array
        if ORIGINAL_MICHO not in [str(b) for b in current_biz]:
            update_fields["business_ids"] = [ORIGINAL_MICHO]
            needs_fix = True

        # Fix stale business_id (singular) — must match or be removed
        if str(stale_biz_id) != ORIGINAL_MICHO:
            update_fields["business_id"] = ORIGINAL_MICHO
            needs_fix = True

        if needs_fix:
            await db.users.update_one(
                {"_id": james["_id"]},
                {"$set": update_fields}
            )
            print(f"  ✅ Relinked james → {ORIGINAL_MICHO}")
            if "business_id" in update_fields:
                print(f"     Fixed stale business_id: {stale_biz_id} → {ORIGINAL_MICHO}")
        else:
            print(f"  ✅ Already linked to original Micho")

    # ═══════════════════════════════════════════════════════════════
    # 3b. LEVELAMBASSADOR → ORIGINAL REJUVENATE
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 3b. FIX LEVELAMBASSADOR → ORIGINAL REJUVENATE ═══")
    natalie = await db.users.find_one({"email": "levelambassador@gmail.com"})
    if natalie:
        nat_biz = natalie.get("business_ids", [])
        nat_stale = natalie.get("business_id", "")
        nat_update = {}
        if ORIGINAL_REJUVENATE not in [str(b) for b in nat_biz]:
            nat_update["business_ids"] = [ORIGINAL_REJUVENATE]
        if str(nat_stale) != ORIGINAL_REJUVENATE:
            nat_update["business_id"] = ORIGINAL_REJUVENATE
        if nat_update:
            await db.users.update_one({"_id": natalie["_id"]}, {"$set": nat_update})
            print(f"  ✅ Relinked levelambassador → {ORIGINAL_REJUVENATE}")
        else:
            print(f"  ✅ Already linked to original Rejuvenate")

    # ═══════════════════════════════════════════════════════════════
    # 3c. DELETE DUPLICATE BUSINESSES
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 3c. DELETE DUPLICATE BUSINESSES ═══")
    # Originals: Micho=699bdb20a2ccbc6589c1d0f8, Rejuvenate=699bdb20a2ccbc6589c1d0f7
    # Find duplicates by name (same name, different ID from original)
    for orig_id, orig_name in [(ORIGINAL_MICHO, "Micho"), (ORIGINAL_REJUVENATE, "Rejuvenate")]:
        orig = await db.businesses.find_one({"_id": ObjectId(orig_id)})
        if not orig:
            continue
        dupes = await db.businesses.find({
            "name": orig["name"],
            "_id": {"$ne": ObjectId(orig_id)}
        }).to_list(None)
        for dupe in dupes:
            dupe_id = str(dupe["_id"])
            # Reassign any users pointing to the dupe
            await db.users.update_many(
                {"business_ids": dupe_id},
                {"$set": {"business_ids": [orig_id], "business_id": orig_id}}
            )
            # Reassign any bookings pointing to the dupe
            await db.bookings.update_many(
                {"businessId": dupe_id},
                {"$set": {"businessId": orig_id}}
            )
            # Delete the duplicate
            await db.businesses.delete_one({"_id": dupe["_id"]})
            print(f"  ✅ Deleted duplicate {orig_name}: {dupe_id} (users/bookings reassigned → {orig_id})")
    
    # Verify remaining businesses
    remaining = await db.businesses.find({}, {"name": 1, "type": 1, "category": 1}).to_list(None)
    print(f"  📊 Remaining businesses: {len(remaining)}")
    for b in remaining:
        print(f"     {b['_id']}: {b.get('name')} — type={b.get('type')} category={b.get('category')}")

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

    # ═══════════════════════════════════════════════════════════════
    # 7. NUKE ALL REMAINING LEGACY BOOKING FIELDS
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 7. NUKE LEGACY BOOKING FIELDS ═══")
    legacy_fields = [
        "table_name", "channel", "table_id", "staff_id", "server_id",
        "start_time", "end_time", "turn_time", "duration_minutes",
        "party_size", "guests", "covers", "client_name", "guest_name",
        "client_phone", "client_email", "customerName", "customerPhone",
        "customerEmail", "is_vip", "is_new_client", "deposit_paid",
        "created_at", "updated_at", "business_id",
    ]
    total_cleaned = 0
    for field in legacy_fields:
        result = await db.bookings.update_many(
            {field: {"$exists": True}},
            {"$unset": {field: ""}}
        )
        if result.modified_count:
            print(f"  ✅ Removed '{field}' from {result.modified_count} bookings")
            total_cleaned += result.modified_count
    if total_cleaned == 0:
        print("  ✅ No legacy fields found — already clean")

    # ═══════════════════════════════════════════════════════════════
    # 8. CLEAN ALL USERS — remove stale/null fields, sync business_id
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ 8. CLEAN USER RECORDS ═══")
    all_users = await db.users.find({}).to_list(None)
    user_fixes = 0
    for u in all_users:
        updates = {}
        unsets = {}
        
        # Remove businessId: None (useless field)
        if u.get("businessId") is None and "businessId" in u:
            unsets["businessId"] = ""
        
        # Sync business_id to match business_ids[0] if they differ
        biz_ids = u.get("business_ids", [])
        biz_id_single = u.get("business_id", "")
        if biz_ids and len(biz_ids) > 0:
            correct = str(biz_ids[0])
            if str(biz_id_single) != correct:
                updates["business_id"] = correct
        elif not biz_ids and biz_id_single:
            # Has business_id but no business_ids — clean it
            unsets["business_id"] = ""
        
        ops = {}
        if updates:
            ops["$set"] = updates
        if unsets:
            ops["$unset"] = unsets
        if ops:
            await db.users.update_one({"_id": u["_id"]}, ops)
            user_fixes += 1
    
    if user_fixes:
        print(f"  ✅ Cleaned {user_fixes} user records")
    else:
        print("  ✅ All user records clean")

    # ═══════════════════════════════════════════════════════════════
    # FINAL AUDIT — print the state of the entire system
    # ═══════════════════════════════════════════════════════════════
    print("\n═══ FINAL AUDIT ═══")
    biz_count = await db.businesses.count_documents({})
    user_count = await db.users.count_documents({})
    booking_count = await db.bookings.count_documents({})
    legacy_check = 0
    for lf in ["table_name", "channel", "party_size", "customerName", "client_name"]:
        legacy_check += await db.bookings.count_documents({lf: {"$exists": True}})
    owner_count = await db.users.count_documents({"role": "owner"})
    admin_count = await db.users.count_documents({"role": "admin"})
    print(f"  Businesses: {biz_count}")
    print(f"  Users: {user_count}")
    print(f"  Bookings: {booking_count}")
    print(f"  Legacy booking fields remaining: {legacy_check} {'✅' if legacy_check == 0 else '❌'}")
    print(f"  Legacy 'owner' roles remaining: {owner_count} {'✅' if owner_count == 0 else '❌'}")
    print(f"  Legacy 'admin' roles remaining: {admin_count} {'✅' if admin_count == 0 else '❌'}")

    print("\n═══ DONE ═══")
    client.close()

asyncio.run(main())
