"""
Seed upcoming bookings for Rejuvenate — today + next 7 days.
Run on VPS: cd /opt/rezvo-app && python3 backend/scripts/seed_upcoming_bookings.py
"""
import asyncio
import random
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv("/opt/rezvo-app/backend/.env")
import sys, os
sys.path.insert(0, "/opt/rezvo-app/backend")

BIZ_ID = "699bdb20a2ccbc6589c1d0f7"

# Staff and services loaded from DB at runtime — see seed() function

SERVICES = [
    {"name": "Luxury Lymphatic Lift Facial", "duration": 75, "price": 85, "category": "Facials"},
    {"name": "Express Lymphatic Lift", "duration": 45, "price": 55, "category": "Facials"},
    {"name": "Dermaplaning Facial", "duration": 60, "price": 65, "category": "Facials"},
    {"name": "BioRePeelCI3", "duration": 30, "price": 95, "category": "Chemical Peels"},
    {"name": "Microneedling Facial", "duration": 60, "price": 120, "category": "Microneedling"},
    {"name": "RF Microneedling — Neck & Jawline", "duration": 45, "price": 150, "category": "RF Needling"},
    {"name": "Polynucleotides — Full Face", "duration": 30, "price": 200, "category": "Polynucleotides"},
    {"name": "Skin Consultation", "duration": 30, "price": 0, "category": "Consultations"},
]

CLIENTS = [
    "Sarah Williams", "Emma Jones", "Charlotte Davies", "Olivia Evans", "Sophie Thomas",
    "Lucy Morgan", "Hannah Price", "Amy Lewis", "Jessica Edwards", "Rebecca Roberts",
    "Laura Phillips", "Katie Jenkins", "Megan Hughes", "Chloe Griffiths", "Rachel Morris",
    "Holly James", "Lauren Richards", "Gemma Taylor", "Victoria Brown", "Natasha Green",
]

TIMES = ["09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]


def gen_ref():
    import string
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def end_time(start, duration):
    h, m = map(int, start.split(":"))
    total = h * 60 + m + duration
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


async def seed():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    # Load staff from business document
    from bson import ObjectId
    biz = await db.businesses.find_one({"_id": BIZ_ID})
    if not biz:
        biz = await db.businesses.find_one({"_id": ObjectId(BIZ_ID)})
    if not biz:
        print("ERROR: Rejuvenate not found")
        return
    STAFF = [{"id": s["id"], "name": s["name"]} for s in biz.get("staff", []) if s.get("active", True)]
    if not STAFF:
        print("ERROR: No active staff found")
        return
    print(f"Loaded {len(STAFF)} staff: {[s['name'] for s in STAFF]}")

    today = datetime.utcnow().date()
    bookings = []

    for day_offset in range(8):  # today + 7 days
        d = today + timedelta(days=day_offset)
        date_str = d.isoformat()

        # Skip Sundays or reduce count
        day_name = d.strftime("%A").lower()
        if day_name == "sunday":
            n_bookings = random.randint(2, 4)
        elif day_name == "saturday":
            n_bookings = random.randint(4, 7)
        else:
            n_bookings = random.randint(5, 10)

        used_slots = set()

        for _ in range(n_bookings):
            staff = random.choice(STAFF)
            svc = random.choice(SERVICES)
            client_name = random.choice(CLIENTS)

            # Pick a time that hasn't been used for this staff
            attempts = 0
            while attempts < 20:
                time_slot = random.choice(TIMES)
                key = f"{staff['id']}_{time_slot}"
                if key not in used_slots:
                    used_slots.add(key)
                    break
                attempts += 1
            else:
                continue

            ref = gen_ref()
            phone = f"07{random.randint(100000000, 999999999)}"
            email = client_name.lower().replace(" ", ".") + "@gmail.com"

            doc = {
                "_id": f"bkg_{d.strftime('%Y%m%d')}_{ref}_{BIZ_ID[:8]}",
                "reference": ref,
                "businessId": BIZ_ID,
                "type": "services",
                "status": random.choices(["confirmed", "pending"], weights=[85, 15])[0],
                "service": {
                    "name": svc["name"],
                    "duration": svc["duration"],
                    "price": svc["price"],
                    "category": svc["category"],
                },
                "staffId": staff["id"],
                "staffName": staff["name"],
                "date": date_str,
                "time": time_slot,
                "duration": svc["duration"],
                "endTime": end_time(time_slot, svc["duration"]),
                "customer": {
                    "name": client_name,
                    "phone": phone,
                    "email": email,
                },
                "notes": "",
                "source": "online",
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
            }
            bookings.append(doc)

    if bookings:
        # Remove any existing upcoming bookings we may have seeded before
        await db.bookings.delete_many({
            "businessId": BIZ_ID,
            "date": {"$gte": today.isoformat()},
            "source": "online",
            "_id": {"$regex": "^bkg_"}
        })
        await db.bookings.insert_many(bookings)

    print(f"Seeded {len(bookings)} upcoming bookings across {8} days")
    print(f"  Today ({today.isoformat()}): {sum(1 for b in bookings if b['date'] == today.isoformat())} bookings")
    for i in range(1, 8):
        d = (today + timedelta(days=i)).isoformat()
        count = sum(1 for b in bookings if b['date'] == d)
        print(f"  {d}: {count} bookings")


asyncio.run(seed())
