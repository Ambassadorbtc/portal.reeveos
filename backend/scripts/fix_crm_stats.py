"""
CRM Stats Fix — recalculate client stats from actual booking data,
then recalculate health scores and pipeline stages.
Run: cd /opt/rezvo-app && python3 backend/scripts/fix_crm_stats.py
"""
import asyncio
import os
import sys
import re
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

    # Get all bookings for Rejuvenate
    all_bookings = await db.bookings.find({"businessId": REJUVENATE_BIZ_ID}).to_list(5000)
    print(f"Found {len(all_bookings)} total bookings")

    # Get all clients
    all_clients = await db.clients.find({
        "$or": [{"businessId": REJUVENATE_BIZ_ID}, {"business_id": REJUVENATE_BIZ_ID}]
    }).to_list(2000)
    print(f"Found {len(all_clients)} clients")

    # Build lookup: email/phone → client
    email_to_client = {}
    phone_to_client = {}
    for c in all_clients:
        email = (c.get("email") or "").strip().lower()
        phone = (c.get("phoneNormalized") or c.get("phone") or "").strip()
        phone_digits = re.sub(r'\D', '', phone)[-10:] if phone else ""
        if email:
            email_to_client[email] = c
        if phone_digits and len(phone_digits) >= 6:
            phone_to_client[phone_digits] = c

    # Compute stats from bookings
    client_stats = {}  # client _id → stats

    for b in all_bookings:
        # Find matching client
        cust = b.get("customer", {})
        cust_email = (cust.get("email") or "").strip().lower() if isinstance(cust, dict) else ""
        cust_phone = re.sub(r'\D', '', (cust.get("phone") or "")) if isinstance(cust, dict) else ""
        cust_phone = cust_phone[-10:] if len(cust_phone) >= 10 else cust_phone
        cust_name = b.get("customerName") or (cust.get("name") if isinstance(cust, dict) else "") or ""

        matched_client = None
        if cust_email and cust_email in email_to_client:
            matched_client = email_to_client[cust_email]
        elif cust_phone and len(cust_phone) >= 6 and cust_phone in phone_to_client:
            matched_client = phone_to_client[cust_phone]

        if not matched_client:
            continue

        cid = str(matched_client["_id"])
        if cid not in client_stats:
            client_stats[cid] = {
                "totalBookings": 0, "totalSpent": 0, "noShows": 0,
                "cancellations": 0, "lastVisit": None, "firstVisit": None,
                "completed": 0,
            }

        status = b.get("status", "")
        price = float(b.get("price", 0) or (b.get("service", {}).get("price", 0) if isinstance(b.get("service"), dict) else 0) or 0)
        date_str = b.get("date", "")

        if status == "completed":
            client_stats[cid]["completed"] += 1
            client_stats[cid]["totalBookings"] += 1
            client_stats[cid]["totalSpent"] += price
            if date_str:
                if not client_stats[cid]["lastVisit"] or date_str > client_stats[cid]["lastVisit"]:
                    client_stats[cid]["lastVisit"] = date_str
                if not client_stats[cid]["firstVisit"] or date_str < client_stats[cid]["firstVisit"]:
                    client_stats[cid]["firstVisit"] = date_str
        elif status == "no_show":
            client_stats[cid]["noShows"] += 1
        elif status == "cancelled":
            client_stats[cid]["cancellations"] += 1
        elif status in ("confirmed", "pending", "checked_in"):
            client_stats[cid]["totalBookings"] += 1

    print(f"\nMatched bookings to {len(client_stats)} clients")

    # Update each client
    updated = 0
    for c in all_clients:
        cid = str(c["_id"])
        cs = client_stats.get(cid, {
            "totalBookings": 0, "totalSpent": 0, "noShows": 0,
            "cancellations": 0, "lastVisit": None, "firstVisit": None,
            "completed": 0,
        })

        avg_spend = round(cs["totalSpent"] / cs["completed"], 2) if cs["completed"] > 0 else 0

        stats = {
            "totalBookings": cs["completed"],  # completed visits
            "totalSpent": round(cs["totalSpent"], 2),
            "averageSpend": avg_spend,
            "noShows": cs["noShows"],
            "cancellations": cs["cancellations"],
            "lastVisit": cs["lastVisit"],
            "firstVisit": cs["firstVisit"],
            "visits": cs["completed"],
            "spend": round(cs["totalSpent"], 2),
            "avgSpend": avg_spend,
        }

        # Temporarily update stats for health score calculation
        c["stats"] = stats

        hs = calculate_health_score(c)
        stage = auto_assign_pipeline_stage(c)

        await db.clients.update_one(
            {"_id": c["_id"]},
            {"$set": {
                "stats": stats,
                "health_score": hs,
                "pipeline_stage": stage,
                "updatedAt": now,
            }}
        )
        updated += 1
        name = c.get("name", "?")
        print(f"  {name:30s} → {stage:20s}  health:{hs:3d}  visits:{cs['completed']}  spend:£{round(cs['totalSpent'])}")

    print(f"\nUpdated {updated} clients with real stats, health scores, and pipeline stages")


asyncio.run(main())
