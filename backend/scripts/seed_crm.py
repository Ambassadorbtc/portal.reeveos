"""
CRM Seed — recalculate health scores and pipeline stages for all clients.
Also backfills timeline events from existing booking data.
Run: cd /opt/rezvo-app && python3 backend/scripts/seed_crm.py
"""
import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

REJUVENATE_BIZ_ID = "699bdb20a2ccbc6589c1d0f7"


async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    from helpers.timeline import calculate_health_score, auto_assign_pipeline_stage

    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo
    now = datetime.utcnow()

    # Get all clients for Rejuvenate
    clients = await db.clients.find({
        "$or": [
            {"businessId": REJUVENATE_BIZ_ID},
            {"business_id": REJUVENATE_BIZ_ID},
        ]
    }).to_list(2000)

    print(f"Found {len(clients)} clients for Rejuvenate")

    updated = 0
    for c in clients:
        hs = calculate_health_score(c)
        stage = auto_assign_pipeline_stage(c)

        await db.clients.update_one(
            {"_id": c["_id"]},
            {"$set": {
                "health_score": hs,
                "pipeline_stage": stage,
                "updatedAt": now,
            }}
        )
        updated += 1
        name = c.get("name", "?")
        visits = (c.get("stats", {}).get("totalBookings", 0) or
                  c.get("stats", {}).get("visits", 0) or 0)
        spend = (c.get("stats", {}).get("totalSpent", 0) or
                 c.get("stats", {}).get("spend", 0) or 0)
        print(f"  {name:30s} → {stage:20s}  health:{hs:3d}  visits:{visits}  spend:£{spend}")

    print(f"\nUpdated {updated} clients with health scores and pipeline stages")

    # Backfill timeline from existing bookings
    print("\nBackfilling timeline from completed bookings...")
    existing_timeline = await db.client_timeline.count_documents({"business_id": REJUVENATE_BIZ_ID})
    if existing_timeline > 0:
        print(f"  Timeline already has {existing_timeline} events — skipping backfill")
    else:
        bookings = await db.bookings.find({
            "businessId": REJUVENATE_BIZ_ID,
            "status": "completed"
        }).sort("date", -1).to_list(2000)

        events = []
        for b in bookings:
            cname = b.get("customerName") or b.get("customer", {}).get("name", "Client")
            cid = b.get("customerId", "")
            service = b.get("service", {}).get("name", "") if isinstance(b.get("service"), dict) else str(b.get("service", ""))
            staff = b.get("staffName", "")
            price = float(b.get("price", 0) or b.get("service", {}).get("price", 0) if isinstance(b.get("service"), dict) else 0)
            date_str = b.get("date", "")

            try:
                ts = datetime.strptime(date_str[:10], "%Y-%m-%d") if date_str else now
            except Exception:
                ts = now

            events.append({
                "business_id": REJUVENATE_BIZ_ID,
                "client_id": cid,
                "client_name": cname,
                "event": "booking.completed",
                "category": "booking",
                "summary": f"Completed {service} with {staff}" if staff else f"Completed {service}",
                "details": {
                    "booking_id": str(b.get("_id", "")),
                    "service": service,
                    "staff": staff,
                    "price": price,
                },
                "actor": {"type": "system", "name": "System"},
                "revenue_impact": price,
                "metadata": {},
                "timestamp": ts,
                "immutable": True,
            })

        if events:
            await db.client_timeline.insert_many(events)
            print(f"  Backfilled {len(events)} booking events to timeline")
        else:
            print("  No completed bookings found to backfill")

    # Create indexes
    print("\nCreating indexes...")
    await db.client_timeline.create_index([("business_id", 1), ("timestamp", -1)])
    await db.client_timeline.create_index([("business_id", 1), ("client_id", 1), ("timestamp", -1)])
    await db.client_tasks.create_index([("business_id", 1), ("status", 1), ("due_date", 1)])
    print("Done!")


asyncio.run(main())
