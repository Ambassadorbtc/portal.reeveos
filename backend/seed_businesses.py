"""
ReeveOS Data Seeding Script
Creates two demo businesses with 6 months of realistic data:
1. Rejuvenate - Skin care salon in Cardiff
2. Micho - Turkish restaurant in Sheffield
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta
import random
import bcrypt



# MongoDB connection — reads from .env if available, falls back to local
import os
from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/rezvo")
DB_NAME = os.getenv("MONGODB_DB_NAME", "rezvo")

# ============================================================
# REJUVENATE - Skin Care Experts, Cardiff
# ============================================================
REJUVENATE = {
    "name": "Rejuvenate Skin Experts",
    "type": "salon",
    "category": "salon",
    "subcategory": "skincare",
    "tier": "enterprise",
    "rezvo_tier": "enterprise",
    "slug": "rejuvenate-skin-experts-cardiff",
    "claimed": True,
    "description": "Award-winning skin clinic in Cardiff specialising in advanced facials, laser treatments, chemical peels, and anti-ageing therapies. Expert team delivering visible results.",
    "phone": "02920 123456",
    "email": "hello@rejuvenateskinexperts.co.uk",
    "website": "https://www.rejuvenateskinexperts.co.uk",
    "address": {
        "line1": "High Street",
        "city": "Cardiff",
        "postcode": "CF10 1AX",
        "country": "UK",
        "lat": 51.4816,
        "lng": -3.1791
    },
    "opening_hours": {
        "monday": {"open": "09:00", "close": "18:00"},
        "tuesday": {"open": "09:00", "close": "20:00"},
        "wednesday": {"open": "09:00", "close": "20:00"},
        "thursday": {"open": "09:00", "close": "20:00"},
        "friday": {"open": "09:00", "close": "18:00"},
        "saturday": {"open": "09:00", "close": "17:00"},
        "sunday": {"open": "closed", "close": "closed"},
    },
    "booking_settings": {
        "slot_duration": 15,
        "max_advance_days": 90,
        "cancellation_hours": 24,
        "deposit_required": True,
        "deposit_amount": 25.00,
    },
    "features_enabled": [
        "calendar", "bookings", "staff", "services", "analytics",
        "reviews", "crm", "marketing", "payments", "online_booking",
        "booking_link", "deposits", "reminders", "waitlist"
    ],
    "stripe_connected": True,
}

REJUVENATE_STAFF = [
    {"id": "rej-staff-1", "name": "Natalie Price", "role": "owner", "email": "levelambassador@gmail.com", "color": "#2D6A4F", "specialties": ["advanced facials", "chemical peels", "consultations"], "active": True},
    {"id": "rej-staff-2", "name": "Sophie Williams", "role": "therapist", "email": "sophie@rejuvenate.co.uk", "color": "#E07A5F", "specialties": ["laser treatments", "microneedling", "LED therapy"], "active": True},
    {"id": "rej-staff-3", "name": "Emma Davies", "role": "therapist", "email": "emma@rejuvenate.co.uk", "color": "#81B29A", "specialties": ["facials", "dermaplaning", "skin analysis"], "active": True},
    {"id": "rej-staff-4", "name": "Chloe Morgan", "role": "therapist", "email": "chloe@rejuvenate.co.uk", "color": "#F2CC8F", "specialties": ["body treatments", "peels", "extractions"], "active": True},
]

REJUVENATE_SERVICES = [
    {"name": "Skin Consultation", "duration": 30, "price": 0, "category": "Consultations", "description": "Comprehensive skin analysis with personalised treatment plan"},
    {"name": "Express Facial", "duration": 30, "price": 45, "category": "Facials", "description": "Quick refresh facial for busy schedules"},
    {"name": "Signature Glow Facial", "duration": 60, "price": 85, "category": "Facials", "description": "Our signature treatment combining deep cleanse, exfoliation, and LED therapy"},
    {"name": "Advanced Anti-Ageing Facial", "duration": 75, "price": 120, "category": "Facials", "description": "Premium anti-ageing treatment with peptides and collagen boosting"},
    {"name": "HydraFacial", "duration": 60, "price": 150, "category": "Facials", "description": "Medical-grade hydradermabrasion for deep cleansing and hydration"},
    {"name": "Chemical Peel - Light", "duration": 45, "price": 95, "category": "Peels", "description": "Glycolic acid peel for brightening and texture improvement"},
    {"name": "Chemical Peel - Medium", "duration": 60, "price": 135, "category": "Peels", "description": "TCA peel for deeper skin renewal and pigmentation correction"},
    {"name": "Microneedling", "duration": 60, "price": 175, "category": "Advanced", "description": "Collagen induction therapy for scarring, fine lines, and skin rejuvenation"},
    {"name": "Dermaplaning", "duration": 45, "price": 65, "category": "Facials", "description": "Manual exfoliation removing dead skin and peach fuzz for smooth, glowing skin"},
    {"name": "LED Light Therapy", "duration": 30, "price": 55, "category": "Advanced", "description": "Red and blue light therapy for acne, inflammation, and collagen stimulation"},
    {"name": "Laser Hair Removal - Small Area", "duration": 30, "price": 80, "category": "Laser", "description": "Upper lip, chin, or underarms"},
    {"name": "Laser Hair Removal - Large Area", "duration": 60, "price": 180, "category": "Laser", "description": "Full legs, back, or chest"},
    {"name": "Acne Treatment Facial", "duration": 60, "price": 95, "category": "Facials", "description": "Targeted treatment for active acne with extractions and blue LED"},
    {"name": "Back Facial", "duration": 45, "price": 75, "category": "Body", "description": "Deep cleanse and treatment for back skin concerns"},
    {"name": "Luxury Pamper Package", "duration": 120, "price": 220, "category": "Packages", "description": "Full facial, dermaplaning, LED therapy, and relaxation massage"},
]

# ============================================================
# MICHO - Turkish Bar & Grill, Sheffield
# ============================================================
MICHO = {
    "name": "Micho Turkish Bar & Grill",
    "type": "restaurant",
    "category": "restaurant",
    "subcategory": "turkish",
    "tier": "enterprise",
    "rezvo_tier": "enterprise",
    "slug": "micho-turkish-bar-grill-sheffield",
    "claimed": True,
    "description": "Authentic Turkish cuisine in the heart of Sheffield. From sizzling kebabs and mezes to fresh-baked pide and baklava. Live entertainment weekends.",
    "phone": "01onal 123 4567",
    "email": "peter.griffin8222@gmail.com",
    "website": "https://michoturkishbarandgrill.co.uk",
    "address": {
        "line1": "Ecclesall Road",
        "city": "Sheffield",
        "postcode": "S11 8PR",
        "country": "UK",
        "lat": 53.3631,
        "lng": -1.4863
    },
    "opening_hours": {
        "monday": {"open": "16:00", "close": "23:00"},
        "tuesday": {"closed": True},
        "wednesday": {"open": "16:00", "close": "23:00"},
        "thursday": {"open": "16:00", "close": "23:00"},
        "friday": {"open": "12:00", "close": "23:00"},
        "saturday": {"open": "12:00", "close": "23:00"},
        "sunday": {"open": "12:00", "close": "21:00"},
    },
    "openingHours": {
        "mon": {"open": True, "start": "16:00", "end": "23:00"},
        "tue": {"open": False, "start": "00:00", "end": "00:00"},
        "wed": {"open": True, "start": "16:00", "end": "23:00"},
        "thu": {"open": True, "start": "16:00", "end": "23:00"},
        "fri": {"open": True, "start": "12:00", "end": "23:00"},
        "sat": {"open": True, "start": "12:00", "end": "23:00"},
        "sun": {"open": True, "start": "12:00", "end": "21:00"},
    },
    "booking_settings": {
        "slot_duration": 30,
        "max_party_size": 20,
        "max_advance_days": 60,
        "cancellation_hours": 4,
        "deposit_required": True,
        "deposit_amount_per_head": 10.00,
        "turn_times": {"2": 75, "4": 90, "6": 105, "8": 120},
        "service_periods": [
            {"name": "Lunch", "start": "12:00", "end": "15:00"},
            {"name": "Dinner", "start": "17:00", "end": "23:00"},
        ],
    },
    "features_enabled": [
        "calendar", "bookings", "staff", "services", "floor_plan",
        "tables", "analytics", "reviews", "crm", "marketing",
        "orders", "payments", "online_booking", "booking_link",
        "deposits", "reminders", "waitlist", "delivery"
    ],
    "stripe_connected": True,
}

MICHO_STAFF = [
    {"id": "mic-staff-1", "name": "Sakine Kizilkya", "role": "owner", "email": "peter.griffin8222@gmail.com", "color": "#D62828", "active": True},
    {"id": "mic-staff-2", "name": "Ahmet", "role": "manager", "email": "ahmet@micho.co.uk", "color": "#003049", "active": True},
    {"id": "mic-staff-3", "name": "Yusuf", "role": "chef", "email": "yusuf@micho.co.uk", "color": "#F77F00", "active": True},
    {"id": "mic-staff-4", "name": "Elif", "role": "waitress", "email": "elif@micho.co.uk", "color": "#81B29A", "active": True},
    {"id": "mic-staff-5", "name": "Murat", "role": "waiter", "email": "murat@micho.co.uk", "color": "#FCBF49", "active": True},
]

MICHO_TABLES = [
    {"id": "t1", "name": "Table 1", "capacity": 2, "shape": "round", "zone": "Window", "x": 10, "y": 15},
    {"id": "t2", "name": "Table 2", "capacity": 2, "shape": "round", "zone": "Window", "x": 10, "y": 35},
    {"id": "t3", "name": "Table 3", "capacity": 4, "shape": "square", "zone": "Main", "x": 35, "y": 15},
    {"id": "t4", "name": "Table 4", "capacity": 4, "shape": "square", "zone": "Main", "x": 35, "y": 35},
    {"id": "t5", "name": "Table 5", "capacity": 6, "shape": "rectangle", "zone": "Main", "x": 35, "y": 55},
    {"id": "t6", "name": "Table 6", "capacity": 8, "shape": "rectangle", "zone": "Main", "x": 60, "y": 15},
    {"id": "t7", "name": "Table 7", "capacity": 4, "shape": "square", "zone": "Main", "x": 60, "y": 40},
    {"id": "t8", "name": "Table 8", "capacity": 2, "shape": "round", "zone": "Bar", "x": 85, "y": 20},
    {"id": "t9", "name": "Table 9", "capacity": 2, "shape": "round", "zone": "Bar", "x": 85, "y": 40},
    {"id": "t10", "name": "Table 10", "capacity": 4, "shape": "square", "zone": "Patio", "x": 60, "y": 75},
    {"id": "t11", "name": "Table 11", "capacity": 6, "shape": "rectangle", "zone": "Patio", "x": 35, "y": 75},
    {"id": "t12", "name": "Table 12", "capacity": 10, "shape": "rectangle", "zone": "Private", "x": 85, "y": 70},
]

MICHO_MENU = [
    {"name": "Mixed Meze Platter", "price": 14.95, "category": "Starters"},
    {"name": "Hummus", "price": 5.95, "category": "Starters"},
    {"name": "Halloumi Fries", "price": 7.95, "category": "Starters"},
    {"name": "Lamb Shish Kebab", "price": 16.95, "category": "Grills"},
    {"name": "Chicken Shish Kebab", "price": 14.95, "category": "Grills"},
    {"name": "Adana Kebab", "price": 15.95, "category": "Grills"},
    {"name": "Mixed Grill for 2", "price": 36.95, "category": "Grills"},
    {"name": "Lamb Pide", "price": 13.95, "category": "Pide"},
    {"name": "Cheese Pide", "price": 11.95, "category": "Pide"},
    {"name": "Iskender Kebab", "price": 17.95, "category": "Specialities"},
    {"name": "Lamb Moussaka", "price": 14.95, "category": "Specialities"},
    {"name": "Sea Bass Fillet", "price": 18.95, "category": "Seafood"},
    {"name": "King Prawn Casserole", "price": 19.95, "category": "Seafood"},
    {"name": "Baklava", "price": 6.95, "category": "Desserts"},
    {"name": "Kunefe", "price": 8.95, "category": "Desserts"},
    {"name": "Turkish Tea", "price": 2.50, "category": "Drinks"},
    {"name": "Turkish Coffee", "price": 3.50, "category": "Drinks"},
    {"name": "Ayran", "price": 3.00, "category": "Drinks"},
    {"name": "Efes Beer", "price": 5.50, "category": "Drinks"},
    {"name": "House Wine (Glass)", "price": 6.50, "category": "Drinks"},
]

# ============================================================
# CLIENT DATA GENERATORS
# ============================================================
FIRST_NAMES = ["Emma", "Olivia", "Amelia", "Isla", "Ava", "Mia", "Isabella", "Sophie", "Grace", "Lily",
               "James", "Oliver", "Harry", "Jack", "George", "Noah", "Charlie", "Jacob", "Alfie", "Freddie",
               "Charlotte", "Emily", "Poppy", "Jessica", "Ruby", "Daisy", "Alice", "Florence", "Rosie", "Sienna",
               "Thomas", "Oscar", "William", "Henry", "Archie", "Joshua", "Leo", "Ethan", "Max", "Lucas",
               "Zara", "Fatima", "Priya", "Aisha", "Chen", "Yuki", "Maria", "Anna", "Elena", "Sara"]
LAST_NAMES = ["Smith", "Jones", "Williams", "Brown", "Taylor", "Davies", "Evans", "Thomas", "Johnson", "Roberts",
              "Walker", "Wright", "Robinson", "Thompson", "White", "Hughes", "Edwards", "Green", "Hall", "Lewis",
              "Harris", "Clark", "Patel", "Khan", "Ali", "Singh", "Chen", "Wang", "Kim", "Park",
              "Morgan", "Cooper", "Ward", "Morris", "King", "Turner", "Phillips", "Carter", "Murphy", "Price"]

OCCASIONS = ["birthday", "anniversary", "business", "date_night", "celebration", "graduation", None, None, None, None]
ALLERGIES = [None, None, None, None, None, "nut allergy", "gluten free", "dairy free", "vegetarian", "vegan", "halal"]
BOOKING_CHANNELS = ["online", "online", "online", "phone", "phone", "walk_in", "instagram", "google"]
STATUSES_SALON = ["completed", "completed", "completed", "completed", "completed", "completed", "no_show", "cancelled", "confirmed"]
STATUSES_REST = ["completed", "completed", "completed", "completed", "completed", "seated", "no_show", "cancelled", "confirmed"]

def gen_phone():
    return f"07{random.randint(100,999)} {random.randint(100,999)} {random.randint(100,999)}"

def gen_client(idx):
    fn = random.choice(FIRST_NAMES)
    ln = random.choice(LAST_NAMES)
    email = f"{fn.lower()}.{ln.lower()}{random.randint(1,99)}@{'gmail.com' if random.random() > 0.3 else 'outlook.com'}"
    return {
        "name": f"{fn} {ln}",
        "email": email,
        "phone": gen_phone(),
        "notes": "",
        "tags": [],
        "visit_count": 0,
        "total_spend": 0,
        "is_vip": random.random() < 0.08,
        "allergies": random.choice(ALLERGIES),
        "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 180)),
    }

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("🗑️  Cleaning existing demo data...")
    for email in ["levelambassador@gmail.com", "peter.griffin8222@gmail.com"]:
        user = await db.users.find_one({"email": email})
        if user:
            biz_ids = user.get("business_ids", [])
            for bid in biz_ids:
                await db.businesses.delete_one({"_id": ObjectId(bid)})
                await db.appointments.delete_many({"business_id": bid})
                await db.bookings.delete_many({"business_id": bid})
                await db.clients.delete_many({"business_id": bid})
                await db.services.delete_many({"business_id": bid})
                await db.reviews.delete_many({"business_id": bid})
                await db.sales.delete_many({"business_id": bid})
            await db.users.delete_one({"_id": user["_id"]})
    
    # ============================================================
    # CREATE USERS
    # ============================================================
    print("👤 Creating user accounts...")
    
    pw_hash = bcrypt.hashpw("Rezvo2024!".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    natalie_user = {
        "name": "Natalie Price",
        "email": "levelambassador@gmail.com",
        "password_hash": pw_hash,
        "role": "business_owner",
        "account_type": "business_owner",
        "business_ids": [],
        "phone": "07700 900123",
        "created_at": datetime.utcnow() - timedelta(days=180),
        "updated_at": datetime.utcnow(),
        "is_active": True,
        "email_verified": True,
    }
    nat_result = await db.users.insert_one(natalie_user)
    nat_id = str(nat_result.inserted_id)
    print(f"  ✅ Natalie Price ({nat_id})")
    
    sakine_user = {
        "name": "Sakine Kizilkya",
        "email": "peter.griffin8222@gmail.com",
        "password_hash": pw_hash,
        "role": "business_owner",
        "account_type": "business_owner",
        "business_ids": [],
        "phone": "07700 900456",
        "created_at": datetime.utcnow() - timedelta(days=180),
        "updated_at": datetime.utcnow(),
        "is_active": True,
        "email_verified": True,
    }
    sak_result = await db.users.insert_one(sakine_user)
    sak_id = str(sak_result.inserted_id)
    print(f"  ✅ Sakine Kizilkya ({sak_id})")
    
    # ============================================================
    # CREATE BUSINESSES
    # ============================================================
    print("🏢 Creating businesses...")
    
    REJUVENATE["owner_id"] = nat_id
    REJUVENATE["staff"] = REJUVENATE_STAFF
    # Embed menu for booking API (book.py reads business.menu)
    REJUVENATE["menu"] = []
    for i, svc in enumerate(REJUVENATE_SERVICES):
        REJUVENATE["menu"].append({
            "id": f"rej-svc-{i+1}",
            "name": svc["name"],
            "category": svc["category"],
            "duration_minutes": svc["duration"],
            "price": svc["price"],
            "description": svc["description"],
            "active": True,
        })
    REJUVENATE["created_at"] = datetime.utcnow() - timedelta(days=180)
    REJUVENATE["updated_at"] = datetime.utcnow()
    rej_result = await db.businesses.insert_one(REJUVENATE)
    rej_id = str(rej_result.inserted_id)
    print(f"  ✅ Rejuvenate ({rej_id})")
    
    MICHO["owner_id"] = sak_id
    MICHO["staff"] = MICHO_STAFF
    MICHO["tables"] = MICHO_TABLES
    # Embed menu for booking API
    MICHO["menu"] = []
    for i, item in enumerate(MICHO_MENU):
        MICHO["menu"].append({
            "id": f"mic-menu-{i+1}",
            "name": item["name"],
            "category": item["category"],
            "price": item["price"],
            "duration_minutes": 0,
            "description": "",
            "active": True,
        })
    MICHO["created_at"] = datetime.utcnow() - timedelta(days=180)
    MICHO["updated_at"] = datetime.utcnow()
    mic_result = await db.businesses.insert_one(MICHO)
    mic_id = str(mic_result.inserted_id)
    print(f"  ✅ Micho ({mic_id})")
    
    # Link businesses to users
    await db.users.update_one({"_id": nat_result.inserted_id}, {"$set": {"business_ids": [rej_id]}})
    await db.users.update_one({"_id": sak_result.inserted_id}, {"$set": {"business_ids": [mic_id]}})
    
    # ============================================================
    # CREATE SERVICES
    # ============================================================
    print("💅 Creating services...")
    rej_service_ids = []
    for svc in REJUVENATE_SERVICES:
        svc["business_id"] = rej_id
        svc["active"] = True
        svc["created_at"] = datetime.utcnow() - timedelta(days=180)
        result = await db.services.insert_one(svc)
        rej_service_ids.append({"id": str(result.inserted_id), **svc})
    print(f"  ✅ {len(rej_service_ids)} Rejuvenate services")
    
    mic_menu_ids = []
    for item in MICHO_MENU:
        item["business_id"] = mic_id
        item["active"] = True
        item["created_at"] = datetime.utcnow() - timedelta(days=180)
        result = await db.services.insert_one(item)
        mic_menu_ids.append({"id": str(result.inserted_id), **item})
    print(f"  ✅ {len(mic_menu_ids)} Micho menu items")
    
    # ============================================================
    # CREATE CLIENTS
    # ============================================================
    print("👥 Creating clients...")
    rej_clients = []
    for i in range(120):
        c = gen_client(i)
        c["business_id"] = rej_id
        result = await db.clients.insert_one(c)
        rej_clients.append({"id": str(result.inserted_id), **c})
    print(f"  ✅ {len(rej_clients)} Rejuvenate clients")
    
    mic_clients = []
    for i in range(200):
        c = gen_client(i)
        c["business_id"] = mic_id
        result = await db.clients.insert_one(c)
        mic_clients.append({"id": str(result.inserted_id), **c})
    print(f"  ✅ {len(mic_clients)} Micho clients")
    
    # ============================================================
    # CREATE APPOINTMENTS (Rejuvenate - 6 months)
    # ============================================================
    print("📅 Creating Rejuvenate appointments (6 months)...")
    rej_appointments = []
    start_date = datetime.utcnow() - timedelta(days=180)
    
    for day_offset in range(187):  # 180 days back + 7 days forward
        date = start_date + timedelta(days=day_offset)
        if date.weekday() == 6:  # Sunday closed
            continue
        
        # 8-14 appointments per day
        num_appts = random.randint(8, 14)
        if date.weekday() == 5:  # Saturday busier
            num_appts = random.randint(10, 16)
        
        for _ in range(num_appts):
            service = random.choice(rej_service_ids)
            staff = random.choice(REJUVENATE_STAFF)
            client = random.choice(rej_clients)
            
            hour = random.randint(9, 17)
            minute = random.choice([0, 15, 30, 45])
            appt_time = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            is_future = appt_time > datetime.utcnow()
            if is_future:
                status = random.choice(["confirmed", "confirmed", "confirmed", "pending"])
            else:
                status = random.choice(STATUSES_SALON)
            
            is_new = client.get("visit_count", 0) == 0 and random.random() < 0.15
            
            appt = {
                "business_id": rej_id,
                "client_id": client["id"],
                "client_name": client["name"],
                "client_email": client["email"],
                "client_phone": client["phone"],
                "service_id": service["id"],
                "service_name": service["name"],
                "staff_id": staff["id"],
                "staff_name": staff["name"],
                "date": appt_time.strftime("%Y-%m-%d"),
                "start_time": appt_time.strftime("%H:%M"),
                "end_time": (appt_time + timedelta(minutes=service["duration"])).strftime("%H:%M"),
                "duration": service["duration"],
                "price": service["price"],
                "status": status,
                "channel": random.choice(BOOKING_CHANNELS),
                "is_new_client": is_new,
                "notes": random.choice(["", "", "", "Sensitive skin", "Running 10 min late", "Prefers Natalie", "Gift voucher", ""]),
                "deposit_paid": random.random() < 0.7,
                "deposit_amount": 25.00 if random.random() < 0.7 else 0,
                "created_at": appt_time - timedelta(days=random.randint(1, 14)),
                "updated_at": appt_time,
            }
            rej_appointments.append(appt)
    
    if rej_appointments:
        await db.appointments.insert_many(rej_appointments)
    print(f"  ✅ {len(rej_appointments)} appointments")
    
    # ============================================================
    # CREATE BOOKINGS (Micho - 6 months)
    # ============================================================
    print("🍽️  Creating Micho bookings (6 months)...")
    mic_bookings = []
    
    for day_offset in range(187):
        date = start_date + timedelta(days=day_offset)
        
        # Lunch service: 12-15
        num_lunch = random.randint(4, 10)
        # Dinner service: 17-22
        num_dinner = random.randint(8, 18)
        if date.weekday() in [4, 5]:  # Fri/Sat busier
            num_dinner = random.randint(14, 24)
        
        for service_type, num, hours in [("lunch", num_lunch, (12, 15)), ("dinner", num_dinner, (17, 22))]:
            for _ in range(num):
                client = random.choice(mic_clients)
                table = random.choice(MICHO_TABLES)
                party_size = random.choice([2, 2, 2, 4, 4, 4, 3, 5, 6, 8])
                party_size = min(party_size, table["capacity"])
                
                hour = random.randint(hours[0], hours[1] - 1)
                minute = random.choice([0, 15, 30, 45])
                booking_time = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                turn_time = {2: 75, 4: 90, 6: 105, 8: 120}.get(party_size, 90)
                
                is_future = booking_time > datetime.utcnow()
                if is_future:
                    status = random.choice(["confirmed", "confirmed", "confirmed", "pending"])
                else:
                    status = random.choice(STATUSES_REST)
                
                occasion = random.choice(OCCASIONS)
                allergy = client.get("allergies")
                
                avg_spend = party_size * random.uniform(22, 45)
                
                booking = {
                    "business_id": mic_id,
                    "client_id": client["id"],
                    "client_name": client["name"],
                    "client_email": client["email"],
                    "client_phone": client["phone"],
                    "table_id": table["id"],
                    "table_name": table["name"],
                    "zone": table["zone"],
                    "party_size": party_size,
                    "date": booking_time.strftime("%Y-%m-%d"),
                    "start_time": booking_time.strftime("%H:%M"),
                    "end_time": (booking_time + timedelta(minutes=turn_time)).strftime("%H:%M"),
                    "turn_time": turn_time,
                    "service_period": service_type,
                    "status": status,
                    "channel": random.choice(BOOKING_CHANNELS),
                    "occasion": occasion,
                    "allergies": allergy,
                    "dietary": random.choice([None, None, None, "vegetarian", "halal", "gluten_free"]),
                    "is_vip": client.get("is_vip", False),
                    "is_new_client": random.random() < 0.1,
                    "notes": random.choice(["", "", "", "Window seat preferred", "Birthday cake at 8pm", "Highchair needed", "Quiet table please", ""]),
                    "deposit_paid": party_size >= 6,
                    "deposit_amount": party_size * 10 if party_size >= 6 else 0,
                    "total_spend": round(avg_spend, 2) if status == "completed" else 0,
                    "server_id": random.choice(["mic-staff-4", "mic-staff-5"]),
                    "created_at": booking_time - timedelta(days=random.randint(0, 21)),
                    "updated_at": booking_time,
                }
                mic_bookings.append(booking)
    
    if mic_bookings:
        await db.bookings.insert_many(mic_bookings)
    print(f"  ✅ {len(mic_bookings)} bookings")
    
    # ============================================================
    # CREATE SALES DATA
    # ============================================================
    print("💰 Creating sales records...")
    
    rej_sales = []
    for appt in rej_appointments:
        if appt["status"] == "completed" and appt["price"] > 0:
            sale = {
                "business_id": rej_id,
                "client_id": appt["client_id"],
                "client_name": appt["client_name"],
                "appointment_id": None,
                "items": [{"name": appt["service_name"], "price": appt["price"], "quantity": 1}],
                "subtotal": appt["price"],
                "discount": round(appt["price"] * 0.1, 2) if random.random() < 0.1 else 0,
                "total": appt["price"],
                "payment_method": random.choice(["card", "card", "card", "cash", "apple_pay"]),
                "status": "paid",
                "date": appt["date"],
                "created_at": datetime.strptime(appt["date"], "%Y-%m-%d"),
            }
            if sale["discount"] > 0:
                sale["total"] = round(sale["subtotal"] - sale["discount"], 2)
            rej_sales.append(sale)
    
    if rej_sales:
        await db.sales.insert_many(rej_sales)
    print(f"  ✅ {len(rej_sales)} Rejuvenate sales")
    
    mic_sales = []
    for bk in mic_bookings:
        if bk["status"] == "completed" and bk["total_spend"] > 0:
            sale = {
                "business_id": mic_id,
                "client_id": bk["client_id"],
                "client_name": bk["client_name"],
                "booking_id": None,
                "items": [{"name": "Dining", "price": bk["total_spend"], "quantity": 1}],
                "subtotal": bk["total_spend"],
                "total": bk["total_spend"],
                "payment_method": random.choice(["card", "card", "card", "cash"]),
                "status": "paid",
                "party_size": bk["party_size"],
                "date": bk["date"],
                "created_at": datetime.strptime(bk["date"], "%Y-%m-%d"),
            }
            mic_sales.append(sale)
    
    if mic_sales:
        await db.sales.insert_many(mic_sales)
    print(f"  ✅ {len(mic_sales)} Micho sales")
    
    # ============================================================
    # CREATE REVIEWS
    # ============================================================
    print("⭐ Creating reviews...")
    
    rej_reviews = []
    for _ in range(45):
        c = random.choice(rej_clients)
        svc = random.choice(rej_service_ids)
        rating = random.choices([5, 4, 3, 2, 1], weights=[50, 30, 10, 5, 5])[0]
        review = {
            "business_id": rej_id,
            "client_id": c["id"],
            "client_name": c["name"],
            "rating": rating,
            "service_name": svc["name"],
            "text": random.choice([
                "Absolutely amazing results! My skin has never looked better.",
                "Natalie is incredible - so knowledgeable and professional.",
                "The HydraFacial was worth every penny. Glowing for days!",
                "Really welcoming clinic, felt very relaxed.",
                "Good treatment but had to wait 15 minutes past my appointment time.",
                "Best skin clinic in Cardiff, hands down.",
                "The chemical peel was exactly what my skin needed.",
                "Lovely atmosphere and great results.",
                "Sophie did an amazing job with my laser treatment.",
                "Bit pricey but the results speak for themselves.",
                "",
            ]),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 180)),
        }
        rej_reviews.append(review)
    
    if rej_reviews:
        await db.reviews.insert_many(rej_reviews)
    print(f"  ✅ {len(rej_reviews)} Rejuvenate reviews")
    
    mic_reviews = []
    for _ in range(80):
        c = random.choice(mic_clients)
        rating = random.choices([5, 4, 3, 2, 1], weights=[45, 30, 15, 5, 5])[0]
        review = {
            "business_id": mic_id,
            "client_id": c["id"],
            "client_name": c["name"],
            "rating": rating,
            "text": random.choice([
                "Best Turkish food in Sheffield! The mixed grill is incredible.",
                "Amazing atmosphere, especially on weekends with live music.",
                "The Adana kebab was perfectly spiced. Will definitely return.",
                "Great meze selection. Halloumi fries are addictive!",
                "Took a while to get our food but it was worth the wait.",
                "Lovely staff, always welcoming. Sakine makes everyone feel at home.",
                "The baklava is the best I've had outside of Turkey.",
                "Perfect for date night. Romantic setting and delicious food.",
                "Bit noisy on Friday night but the food makes up for it.",
                "Excellent value for money. The mixed grill for 2 is a must!",
                "",
            ]),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 180)),
        }
        mic_reviews.append(review)
    
    if mic_reviews:
        await db.reviews.insert_many(mic_reviews)
    print(f"  ✅ {len(mic_reviews)} Micho reviews")
    
    # ============================================================
    # UPDATE CLIENT STATS
    # ============================================================
    print("📊 Updating client statistics...")
    
    # Rejuvenate client stats
    for c in rej_clients:
        visits = sum(1 for a in rej_appointments if a["client_id"] == c["id"] and a["status"] == "completed")
        spend = sum(a["price"] for a in rej_appointments if a["client_id"] == c["id"] and a["status"] == "completed")
        if visits > 0:
            await db.clients.update_one(
                {"_id": ObjectId(c["id"])},
                {"$set": {"visit_count": visits, "total_spend": round(spend, 2), "last_visit": datetime.utcnow() - timedelta(days=random.randint(1, 30))}}
            )
    
    # Micho client stats
    for c in mic_clients:
        visits = sum(1 for b in mic_bookings if b["client_id"] == c["id"] and b["status"] == "completed")
        spend = sum(b["total_spend"] for b in mic_bookings if b["client_id"] == c["id"] and b["status"] == "completed")
        if visits > 0:
            await db.clients.update_one(
                {"_id": ObjectId(c["id"])},
                {"$set": {"visit_count": visits, "total_spend": round(spend, 2), "last_visit": datetime.utcnow() - timedelta(days=random.randint(1, 30))}}
            )
    
    print("\n" + "=" * 60)
    print("🎉 SEEDING COMPLETE!")
    print("=" * 60)
    print(f"\n📍 Rejuvenate Skin Experts (Cardiff)")
    print(f"   Business ID: {rej_id}")
    print(f"   Owner: Natalie Price (levelambassador@gmail.com)")
    print(f"   Clients: {len(rej_clients)}")
    print(f"   Appointments: {len(rej_appointments)}")
    print(f"   Sales: {len(rej_sales)}")
    print(f"   Reviews: {len(rej_reviews)}")
    
    print(f"\n📍 Micho Turkish Bar & Grill (Sheffield)")
    print(f"   Business ID: {mic_id}")
    print(f"   Owner: Sakine Kizilkya (peter.griffin8222@gmail.com)")
    print(f"   Clients: {len(mic_clients)}")
    print(f"   Bookings: {len(mic_bookings)}")
    print(f"   Sales: {len(mic_sales)}")
    print(f"   Reviews: {len(mic_reviews)}")
    print(f"   Tables: {len(MICHO_TABLES)}")
    
    print(f"\n🔑 Login credentials:")
    print(f"   Rejuvenate: levelambassador@gmail.com / Rezvo2024!")
    print(f"   Micho: peter.griffin8222@gmail.com / Rezvo2024!")
    print(f"\n   ⚠️  Note: password is SHA256 hashed. If your auth uses bcrypt, update the password_hash manually.")

asyncio.run(main())
