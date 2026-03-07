"""
Seed pipeline stages for existing clients based on their booking history.
Run: cd /opt/rezvo-app && python3 backend/scripts/seed_pipeline.py
"""
import asyncio, os, sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

REJUVENATE_BIZ_ID = "699bdb20a2ccbc6589c1d0f7"

async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo
    now = datetime.utcnow()
    six_weeks_ago = now - timedelta(weeks=6)

    # Get all clients for Rejuvenate
    clients = await db.clients.find({
        "$or": [
            {"businessId": REJUVENATE_BIZ_ID},
            {"business_id": REJUVENATE_BIZ_ID},
        ]
    }).to_list(1000)

    print(f"Found {len(clients)} clients for Rejuvenate")

    updated = 0
    for c in clients:
        cid = str(c["_id"])
        stats = c.get("stats", {})
        visits = stats.get("visits", 0)
        spend = stats.get("spend", 0)
        last_visit = c.get("lastVisit") or c.get("last_visit", "")
        tags = c.get("tags", [])
        has_package = c.get("active_package") is not None

        # Determine stage based on history
        if has_package and visits >= 3:
            stage = "active_client"
            value = spend
        elif has_package:
            stage = "package_sold"
            value = spend or 300
        elif visits >= 2:
            stage = "active_client"
            value = spend
        elif visits == 1:
            stage = "first_appointment"
            value = spend or 65
        elif "Consultation" in str(tags) or "consultation" in str(c.get("notes", "")):
            stage = "consultation_booked"
            value = 0
        else:
            # Check if they have any bookings at all
            bkg_count = await db.bookings.count_documents({
                "$or": [{"businessId": REJUVENATE_BIZ_ID}, {"business_id": REJUVENATE_BIZ_ID}],
                "$or": [
                    {"customer.email": c.get("email")},
                    {"customer.phone": c.get("phone")},
                ],
            }) if (c.get("email") or c.get("phone")) else 0

            if bkg_count > 0:
                stage = "first_appointment"
                value = 65
            else:
                stage = "new_lead"
                value = 0

        # Check at-risk: had visits but last visit > 6 weeks ago
        if visits > 0 and last_visit:
            try:
                lv = datetime.fromisoformat(str(last_visit).replace("Z", "+00:00")) if "T" in str(last_visit) else datetime.strptime(str(last_visit)[:10], "%Y-%m-%d")
                if lv < six_weeks_ago and stage in ("active_client", "package_sold"):
                    stage = "at_risk"
            except Exception:
                pass

        await db.clients.update_one(
            {"_id": c["_id"]},
            {"$set": {
                "pipeline_stage": stage,
                "pipeline_value": value,
                "updatedAt": now,
            }}
        )
        updated += 1
        print(f"  {c.get('name', '?'):30s} → {stage:25s} (£{value})")

    print(f"\nUpdated {updated} clients with pipeline stages")

asyncio.run(main())
