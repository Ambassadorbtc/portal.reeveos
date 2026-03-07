"""
Seed Rejuvenate Skin Experts with real data.
Staff: Natalie (owner), Grace, Emily, Jen
Treatments from consultation spec + Fresha listing
Opening hours from Fresha
6 months of realistic booking data

Run on VPS: cd /opt/rezvo-app/backend && python3 scripts/seed_rejuvenate.py
"""
import asyncio
import random
from datetime import datetime, timedelta
from bson import ObjectId

# Connect to DB
from dotenv import load_dotenv
load_dotenv("/opt/rezvo-app/backend/.env")
import sys
sys.path.insert(0, "/opt/rezvo-app/backend")

STAFF = [
    {"name": "Natalie", "role": "Owner / Lead Therapist", "email": "natalie@rejuvenateskinexperts.co.uk", "specialties": ["Microneedling", "Lymphatic Lift", "Chemical Peels", "Polynucleotides"]},
    {"name": "Grace", "role": "Senior Therapist", "email": "grace@rejuvenateskinexperts.co.uk", "specialties": ["Microneedling", "Dermaplaning", "Chemical Peels", "Lymphatic Lift"]},
    {"name": "Emily", "role": "Therapist", "email": "emily@rejuvenateskinexperts.co.uk", "specialties": ["Dermaplaning", "Lymphatic Lift", "Chemical Peels"]},
    {"name": "Jen", "role": "Therapist", "email": "jen@rejuvenateskinexperts.co.uk", "specialties": ["Lymphatic Lift", "Dermaplaning", "RF Needling"]},
]

SERVICES = [
    # Facials
    {"name": "Luxury Lymphatic Lift Facial", "category": "Facials", "duration": 75, "price": 85, "description": "Holistic treatment promoting relaxation and lymphatic drainage through breathwork, therapeutic techniques, and advanced skincare."},
    {"name": "Express Lymphatic Lift", "category": "Facials", "duration": 45, "price": 55, "description": "A shorter version of our signature lymphatic facial for those short on time."},
    {"name": "Dermaplaning Facial", "category": "Facials", "duration": 60, "price": 65, "description": "Non-surgical facial exfoliation removing dead skin cells and peach fuzz for a smooth, radiant complexion."},
    {"name": "Dermalogica Pro Power Peel", "category": "Chemical Peels", "duration": 45, "price": 75, "description": "Professional-grade chemical peel customised to your skin type for deep exfoliation and renewal."},
    {"name": "BioRePeelCI3", "category": "Chemical Peels", "duration": 30, "price": 95, "description": "Innovative bi-phasic chemical peel providing bio-stimulation without the social downtime."},
    {"name": "MelanoPro Peel", "category": "Chemical Peels", "duration": 30, "price": 110, "description": "Targeted peel for hyperpigmentation, melasma, and uneven skin tone."},
    {"name": "Power Eye Peel", "category": "Chemical Peels", "duration": 20, "price": 45, "description": "Targeted eye area peel to brighten dark circles and smooth fine lines."},
    # Microneedling
    {"name": "Microneedling Facial", "category": "Microneedling", "duration": 60, "price": 120, "description": "Collagen-stimulating treatment using controlled micro-injuries to rejuvenate skin, reduce scarring, and improve texture."},
    {"name": "Microneedling for Hands", "category": "Microneedling", "duration": 30, "price": 70, "description": "Targeted microneedling for the hands to reduce signs of ageing and improve skin quality."},
    {"name": "Microneedling Course (3 Sessions)", "category": "Microneedling", "duration": 60, "price": 320, "description": "Three microneedling sessions spaced 4-6 weeks apart for optimal collagen stimulation."},
    {"name": "Microneedling Course (6 Sessions)", "category": "Microneedling", "duration": 60, "price": 600, "description": "Six microneedling sessions for comprehensive skin transformation and scarring reduction."},
    # RF Needling
    {"name": "RF Microneedling — Neck & Jawline", "category": "RF Needling", "duration": 45, "price": 150, "description": "Radio frequency microneedling for neck and jawline tightening and contouring."},
    {"name": "RF Microneedling — Body", "category": "RF Needling", "duration": 60, "price": 180, "description": "Body-area RF microneedling for skin tightening and cellulite reduction."},
    # Polynucleotides
    {"name": "Polynucleotides — Full Face", "category": "Polynucleotides", "duration": 30, "price": 200, "description": "Skin booster injections derived from salmon DNA to hydrate, repair, and rejuvenate at a cellular level."},
    {"name": "Polynucleotides — Under Eye", "category": "Polynucleotides", "duration": 20, "price": 150, "description": "Targeted under-eye treatment to reduce dark circles, fine lines, and hollowing."},
    # Consultations
    {"name": "Skin Consultation", "category": "Consultations", "duration": 30, "price": 0, "description": "Complimentary consultation to assess your skin and recommend a bespoke treatment plan."},
    {"name": "Patch Test", "category": "Consultations", "duration": 15, "price": 0, "description": "Required before first microneedling or chemical peel treatment."},
]

HOURS = {
    "monday": {"open": "09:30", "close": "19:30", "closed": False},
    "tuesday": {"open": "09:30", "close": "21:30", "closed": False},
    "wednesday": {"open": "09:30", "close": "21:30", "closed": False},
    "thursday": {"open": "09:30", "close": "21:30", "closed": False},
    "friday": {"open": "09:30", "close": "20:30", "closed": False},
    "saturday": {"open": "10:00", "close": "17:00", "closed": False},
    "sunday": {"open": "11:00", "close": "17:00", "closed": False},
}

# Realistic client names
CLIENT_NAMES = [
    "Sarah Williams", "Emma Jones", "Charlotte Davies", "Olivia Evans", "Sophie Thomas",
    "Lucy Morgan", "Hannah Price", "Amy Lewis", "Jessica Edwards", "Rebecca Roberts",
    "Laura Phillips", "Katie Jenkins", "Megan Hughes", "Chloe Griffiths", "Rachel Morris",
    "Holly James", "Lauren Richards", "Gemma Taylor", "Victoria Brown", "Natasha Green",
    "Zoe Baker", "Abigail Hall", "Bethany Adams", "Danielle Carter", "Ellie Mitchell",
    "Freya Turner", "Georgia White", "Heather Clark", "Imogen Walker", "Jade Robinson",
    "Kim Harrison", "Louise Scott", "Mia Bennett", "Nina Cook", "Poppy Ward",
    "Rose Parker", "Samantha Hill", "Tara Wood", "Uma Patel", "Wendy Fox",
]


async def seed():
    from database import get_database
    # Try to connect
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    client = AsyncIOMotorClient(os.environ.get("MONGODB_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("MONGODB_DB_NAME", "rezvo")]

    # Find the Rejuvenate business
    biz = await db.businesses.find_one({"name": {"$regex": "rejuv", "$options": "i"}})
    if not biz:
        print("ERROR: Rejuvenate business not found in database")
        return

    biz_id = str(biz["_id"])
    print(f"Found: {biz.get('name')} (ID: {biz_id})")

    # ═══════════════════════════════════════
    # 1. UPDATE BUSINESS INFO
    # ═══════════════════════════════════════
    print("\n1. Updating business info...")
    await db.businesses.update_one({"_id": biz["_id"]}, {"$set": {
        "address": "Wilcox House, Dunleavy Drive, Unit 17, Cardiff, CF11 0BA",
        "phone": "",
        "website": "https://www.rejuvenateskinexperts.co.uk",
        "type": "local_services",
        "category": "Aesthetics & Skin Care",
        "opening_hours": HOURS,
        "description": "Step into Rejuvenate, where beauty meets tranquility in Barry. Our luxurious facials, including the renowned Lymphatic Lift and Microneedling treatments, are designed to rejuvenate your skin and enhance your natural glow.",
        "updated_at": datetime.utcnow(),
    }})
    print("  ✓ Business info updated")

    # ═══════════════════════════════════════
    # 2. ADD STAFF
    # ═══════════════════════════════════════
    print("\n2. Adding staff...")
    staff_records = []
    for s in STAFF:
        staff_id = f"staff_{ObjectId()}"
        record = {
            "id": staff_id,
            "name": s["name"],
            "role": s["role"],
            "email": s["email"],
            "specialties": s["specialties"],
            "active": True,
            "working_hours": {
                day: {"start": h["open"], "end": h["close"], "available": not h["closed"]}
                for day, h in HOURS.items()
            },
        }
        staff_records.append(record)
        print(f"  ✓ {s['name']} — {s['role']}")

    await db.businesses.update_one({"_id": biz["_id"]}, {"$set": {"staff": staff_records}})

    # Also insert into staff collection for tenant queries
    await db.staff.delete_many({"$or": [{"business_id": biz_id}, {"businessId": biz_id}]})
    for s in staff_records:
        await db.staff.insert_one({
            "business_id": biz_id,
            "businessId": biz_id,
            "name": s["name"],
            "role": s["role"],
            "email": s["email"],
            "specialties": s["specialties"],
            "active": True,
            "created_at": datetime.utcnow(),
        })

    # ═══════════════════════════════════════
    # 3. ADD SERVICES
    # ═══════════════════════════════════════
    print("\n3. Adding services...")
    await db.services.delete_many({"$or": [{"business_id": biz_id}, {"businessId": biz_id}]})
    service_records = []
    for svc in SERVICES:
        result = await db.services.insert_one({
            "business_id": biz_id,
            "businessId": biz_id,
            "name": svc["name"],
            "category": svc["category"],
            "duration": svc["duration"],
            "price": svc["price"],
            "description": svc["description"],
            "active": True,
            "created_at": datetime.utcnow(),
        })
        service_records.append({**svc, "id": str(result.inserted_id)})
        print(f"  ✓ {svc['name']} — £{svc['price']} ({svc['duration']}min)")

    # ═══════════════════════════════════════
    # 4. GENERATE 6 MONTHS OF BOOKINGS
    # ═══════════════════════════════════════
    print("\n4. Generating 6 months of booking history...")

    # Remove existing seeded bookings
    await db.bookings.delete_many({"businessId": biz_id, "source": "seed"})

    now = datetime.utcnow()
    six_months_ago = now - timedelta(days=180)
    bookable_services = [s for s in SERVICES if s["price"] > 0]

    bookings = []
    current_date = six_months_ago

    while current_date < now:
        day_name = current_date.strftime("%A").lower()
        day_hours = HOURS.get(day_name, {})

        if day_hours.get("closed"):
            current_date += timedelta(days=1)
            continue

        # 3-8 bookings per day (busier on weekdays)
        is_weekday = current_date.weekday() < 5
        num_bookings = random.randint(4, 8) if is_weekday else random.randint(2, 5)

        open_hour = int(day_hours["open"].split(":")[0])
        close_hour = int(day_hours["close"].split(":")[0])

        for _ in range(num_bookings):
            svc = random.choice(bookable_services)
            staff_rec = random.choice(staff_records)
            client = random.choice(CLIENT_NAMES)
            hour = random.randint(open_hour, close_hour - 1)
            minute = random.choice([0, 15, 30, 45])

            booking = {
                "businessId": biz_id,
                "service": {
                    "name": svc["name"],
                    "duration": svc["duration"],
                    "price": svc["price"],
                    "category": svc.get("category", ""),
                },
                "date": current_date.strftime("%Y-%m-%d"),
                "time": f"{hour:02d}:{minute:02d}",
                "duration": svc["duration"],
                "staffId": staff_rec["id"],
                "staffName": staff_rec["name"],
                "status": "completed" if current_date < now - timedelta(days=1) else "confirmed",
                "customer": {
                    "name": client,
                    "email": client.lower().replace(" ", ".") + "@gmail.com",
                    "phone": f"07{random.randint(100000000, 999999999)}",
                },
                "notes": "",
                "source": "seed",
                "createdAt": current_date,
                "updatedAt": current_date,
            }
            bookings.append(booking)

        current_date += timedelta(days=1)

    if bookings:
        await db.bookings.insert_many(bookings)

    # Calculate stats
    total_revenue = sum(b["price"] for b in bookings)
    unique_clients = len(set(b["customer"]["name"] for b in bookings))

    print(f"  ✓ {len(bookings)} bookings generated")
    print(f"  ✓ Revenue: £{total_revenue:,.2f}")
    print(f"  ✓ Unique clients: {unique_clients}")

    # ═══════════════════════════════════════
    # 5. SEED CLIENT RECORDS
    # ═══════════════════════════════════════
    print("\n5. Seeding client records...")
    await db.clients.delete_many({"business_id": biz_id})

    clients_seen = {}
    for b in bookings:
        name = b["customer"]["name"]
        if name not in clients_seen:
            clients_seen[name] = {
                "visits": 0,
                "spend": 0,
                "first": b["date"],
                "last": b["date"],
                "email": b["customer"]["email"],
                "phone": b["customer"]["phone"],
            }
        clients_seen[name]["visits"] += 1
        clients_seen[name]["spend"] += b["price"]
        if b["date"] > clients_seen[name]["last"]:
            clients_seen[name]["last"] = b["date"]

    for name, data in clients_seen.items():
        await db.clients.insert_one({
            "name": name,
            "email": data["email"],
            "phone": data["phone"],
            "business_id": biz_id,
            "tags": ["seeded"],
            "visit_count": data["visits"],
            "total_spend": data["spend"],
            "first_visit": data["first"],
            "last_visit": data["last"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

    print(f"  ✓ {len(clients_seen)} client records created")

    # ═══════════════════════════════════════
    # DONE
    # ═══════════════════════════════════════
    print(f"\n{'='*50}")
    print(f"SEED COMPLETE — Rejuvenate Skin Experts")
    print(f"{'='*50}")
    print(f"Staff: {len(STAFF)}")
    print(f"Services: {len(SERVICES)}")
    print(f"Bookings: {len(bookings)} (6 months)")
    print(f"Revenue: £{total_revenue:,.2f}")
    print(f"Clients: {len(clients_seen)}")
    print(f"Hours: Mon-Fri 9:30am, Sat 10am, Sun 11am")


if __name__ == "__main__":
    asyncio.run(seed())
