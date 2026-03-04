"""
ReeveOS Data Migration — Standardise ALL booking documents
═══════════════════════════════════════════════════════════

This script reads every booking in MongoDB and rewrites it to use
canonical field names. After running this, all bookings will have:

  - customer.name  (not customerName, client_name, guest_name)
  - customer.phone (not customerPhone, client_phone, phone)  
  - customer.email (not customerEmail, client_email, email)
  - partySize      (not party_size, guests, covers)
  - tableId        (not table_id, table)
  - tableName      (not table_name)
  - staffId        (not staff_id, server_id)
  - time           (not start_time)
  - endTime        (not end_time)
  - duration       (not duration_minutes, turn_time)
  - source         (not channel)
  - createdAt      (not created_at)
  - updatedAt      (not updated_at)
  - isVip          (not is_vip)
  - businessId     (always present, string)

Legacy fields are REMOVED to prevent future confusion.

Safe to run multiple times — idempotent.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime


LEGACY_FIELDS_TO_REMOVE = [
    "business_id",      # → businessId
    "customerName",     # → customer.name
    "client_name",      # → customer.name
    "guest_name",       # → customer.name
    "customerPhone",    # → customer.phone
    "client_phone",     # → customer.phone
    "customerEmail",    # → customer.email
    "client_email",     # → customer.email
    "party_size",       # → partySize
    "guests",           # → partySize (duplicate)
    "covers",           # → partySize (duplicate)
    "table_id",         # → tableId
    "table",            # → tableId (duplicate)
    "table_name",       # → tableName
    "staff_id",         # → staffId
    "server_id",        # → staffId
    "start_time",       # → time
    "end_time",         # → endTime
    "duration_minutes", # → duration
    "turn_time",        # → duration
    "channel",          # → source
    "created_at",       # → createdAt
    "updated_at",       # → updatedAt
    "is_vip",           # → isVip
    "is_new_client",    # → not needed
    "deposit_paid",     # → deposit.status
]


async def migrate():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo
    
    total = await db.bookings.count_documents({})
    print(f"\n{'═' * 60}")
    print(f"  REEVEOS BOOKING DATA MIGRATION")
    print(f"  {total} bookings to standardise")
    print(f"{'═' * 60}\n")
    
    migrated = 0
    skipped = 0
    errors = 0
    
    cursor = db.bookings.find({})
    async for doc in cursor:
        try:
            doc_id = doc["_id"]
            update_set = {}
            update_unset = {}
            
            # ── businessId (canonical: string) ──
            biz_id = doc.get("businessId") or doc.get("business_id") or ""
            if biz_id:
                update_set["businessId"] = str(biz_id)
            
            # ── customer (canonical: nested object) ──
            existing_customer = doc.get("customer")
            if existing_customer and isinstance(existing_customer, dict) and existing_customer.get("name"):
                # Already has proper customer object — keep it
                pass
            else:
                # Build from legacy fields
                cust_name = (
                    (existing_customer or {}).get("name") if isinstance(existing_customer, dict) else None
                ) or doc.get("customerName") or doc.get("client_name") or doc.get("guest_name") or ""
                cust_phone = (
                    (existing_customer or {}).get("phone") if isinstance(existing_customer, dict) else None
                ) or doc.get("customerPhone") or doc.get("client_phone") or doc.get("phone") or ""
                cust_email = (
                    (existing_customer or {}).get("email") if isinstance(existing_customer, dict) else None
                ) or doc.get("customerEmail") or doc.get("client_email") or doc.get("email") or ""
                
                update_set["customer"] = {
                    "name": cust_name,
                    "phone": cust_phone,
                    "email": cust_email,
                }
            
            # ── partySize (canonical: int) ──
            party = doc.get("partySize") or doc.get("party_size") or doc.get("guests") or doc.get("covers") or 2
            if isinstance(party, str):
                try:
                    party = int(party)
                except ValueError:
                    party = 2
            update_set["partySize"] = party
            
            # ── tableId / tableName ──
            table_id = doc.get("tableId") or doc.get("table_id") or doc.get("table") or ""
            table_name = doc.get("tableName") or doc.get("table_name") or ""
            update_set["tableId"] = table_id
            update_set["tableName"] = table_name
            
            # ── staffId ──
            staff_id = doc.get("staffId") or doc.get("staff_id") or doc.get("server_id") or ""
            update_set["staffId"] = staff_id
            
            # ── time / endTime / duration ──
            time_val = doc.get("time") or doc.get("start_time") or ""
            end_time = doc.get("endTime") or doc.get("end_time") or ""
            duration = doc.get("duration") or doc.get("duration_minutes") or doc.get("turn_time") or 60
            update_set["time"] = time_val
            update_set["endTime"] = end_time
            update_set["duration"] = duration
            
            # ── source ──
            source = doc.get("source") or doc.get("channel") or "online"
            update_set["source"] = source
            
            # ── timestamps ──
            created = doc.get("createdAt") or doc.get("created_at")
            updated = doc.get("updatedAt") or doc.get("updated_at")
            if created:
                update_set["createdAt"] = created
            if updated:
                update_set["updatedAt"] = updated
            
            # ── isVip ──
            is_vip = doc.get("isVip") or doc.get("is_vip") or False
            update_set["isVip"] = is_vip
            
            # ── Remove legacy fields ──
            for field in LEGACY_FIELDS_TO_REMOVE:
                if field in doc:
                    update_unset[field] = ""
            
            # Don't unset 'phone' and 'email' if they're the ONLY source
            # (they've been copied into customer.{} above)
            if "phone" in doc and "customer" in update_set:
                update_unset["phone"] = ""  # safe — copied to customer.phone
            if "email" in doc and "customer" in update_set:
                # Only unset if it's a customer email, not a top-level booking email
                if not doc.get("customer"):
                    update_unset["email"] = ""
            
            # ── Apply ──
            ops = {}
            if update_set:
                ops["$set"] = update_set
            if update_unset:
                ops["$unset"] = update_unset
            
            if ops:
                await db.bookings.update_one({"_id": doc_id}, ops)
                migrated += 1
            else:
                skipped += 1
                
        except Exception as e:
            errors += 1
            print(f"  ❌ Error on {doc.get('_id')}: {e}")
    
    # ── Summary ──
    print(f"\n{'═' * 60}")
    print(f"  MIGRATION COMPLETE")
    print(f"{'═' * 60}")
    print(f"  ✅ Migrated:  {migrated}")
    print(f"  ⏭️  Skipped:   {skipped}")
    print(f"  ❌ Errors:    {errors}")
    print(f"  📊 Total:     {total}")
    print(f"{'═' * 60}")
    
    # ── Verify ──
    print(f"\n  VERIFICATION:")
    
    # Check no legacy customerName fields remain
    legacy_customer = await db.bookings.count_documents({"customerName": {"$exists": True}})
    legacy_party = await db.bookings.count_documents({"party_size": {"$exists": True}})
    legacy_client = await db.bookings.count_documents({"client_name": {"$exists": True}})
    has_customer_obj = await db.bookings.count_documents({"customer.name": {"$exists": True}})
    
    print(f"  Legacy 'customerName' remaining: {legacy_customer} {'✅' if legacy_customer == 0 else '⚠️'}")
    print(f"  Legacy 'party_size' remaining:   {legacy_party} {'✅' if legacy_party == 0 else '⚠️'}")
    print(f"  Legacy 'client_name' remaining:  {legacy_client} {'✅' if legacy_client == 0 else '⚠️'}")
    print(f"  Documents with customer.name:    {has_customer_obj} {'✅' if has_customer_obj == total else '⚠️'}")
    print(f"{'═' * 60}\n")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
