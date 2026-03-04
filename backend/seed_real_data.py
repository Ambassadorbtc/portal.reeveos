"""
ReeveOS Seed Script — Real User Flow
====================================
Creates a full week of realistic restaurant booking data for Micho Turkish Bar & Grill.
Designed to show the complete lifecycle: booked → confirmed → seated → completed.

Run: python3 seed_real_data.py

What it creates:
  - 30 realistic guest clients with UK names, emails, phones
  - ~120 bookings across 7 days (Mon → Sun)
  - Today = busy day with mix of completed, seated, upcoming, no-shows
  - Floor plan table statuses match currently seated bookings
  - Activity log entries for every booking
  - Staff members linked to the business
"""

import random
import string
from datetime import datetime, timedelta
from pymongo import MongoClient

db = MongoClient("localhost:27017").rezvo

# ══════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════

# Find Micho business
micho = db.businesses.find_one({"slug": "micho-turkish-bar-grill-sheffield"})
if not micho:
    micho = db.businesses.find_one({"name": {"$regex": "Micho", "$options": "i"}})
if not micho:
    print("ERROR: Micho business not found in database")
    exit(1)

BIZ_ID = str(micho["_id"])
print(f"Found Micho: {micho['name']} (ID: {BIZ_ID})")

# Find owner user
owner = db.users.find_one({"email": "james111trader@gmail.com"})
OWNER_ID = str(owner["_id"]) if owner else "owner"

# Today's date
TODAY = datetime.utcnow().date()
MONDAY = TODAY - timedelta(days=TODAY.weekday())  # Start of this week

# Floor plan table IDs (must match FloorPlan.jsx DEFAULT_ELEMENTS)
TABLES = [
    {"id": "t1", "name": "T-01", "seats": 4, "zone": "main", "shape": "round"},
    {"id": "t2", "name": "T-02", "seats": 4, "zone": "main", "shape": "square"},
    {"id": "t3", "name": "T-03", "seats": 2, "zone": "main", "shape": "square"},
    {"id": "t4", "name": "T-04", "seats": 6, "zone": "main", "shape": "round"},
    {"id": "t5", "name": "T-05", "seats": 4, "zone": "main", "shape": "round"},
    {"id": "t6", "name": "T-06", "seats": 8, "zone": "main", "shape": "long"},
    {"id": "t7", "name": "T-07", "seats": 4, "zone": "terrace", "shape": "round"},
    {"id": "t8", "name": "T-08", "seats": 6, "zone": "terrace", "shape": "long"},
]

# ══════════════════════════════════════════════
# REALISTIC UK GUESTS
# ══════════════════════════════════════════════

GUESTS = [
    {"name": "Sarah Mitchell",    "email": "sarah.mitchell@gmail.com",     "phone": "07412 345678"},
    {"name": "James Cooper",      "email": "jamescooper22@hotmail.co.uk",  "phone": "07534 891234"},
    {"name": "Emily Watson",      "email": "emily.w@outlook.com",          "phone": "07701 234567"},
    {"name": "Mohammed Ali",      "email": "m.ali.sheff@gmail.com",        "phone": "07889 345612"},
    {"name": "Charlotte Brown",   "email": "charlotteb@yahoo.co.uk",      "phone": "07456 789012"},
    {"name": "Daniel Smith",      "email": "dan.smith84@gmail.com",        "phone": "07623 456789"},
    {"name": "Sophie Taylor",     "email": "sophietaylor@icloud.com",      "phone": "07745 123456"},
    {"name": "Oliver Johnson",    "email": "oliverjohnson@proton.me",      "phone": "07312 678901"},
    {"name": "Amara Okafor",      "email": "amara.okafor@gmail.com",       "phone": "07867 234567"},
    {"name": "Liam O'Brien",      "email": "liamobrien@hotmail.com",       "phone": "07498 345678"},
    {"name": "Fatima Hassan",     "email": "fatima.h@outlook.com",         "phone": "07534 567890"},
    {"name": "Jack Williams",     "email": "jackw1992@gmail.com",          "phone": "07612 890123"},
    {"name": "Grace Thompson",    "email": "gracet@yahoo.co.uk",           "phone": "07723 456789"},
    {"name": "Ryan Hughes",       "email": "ryan.hughes@gmail.com",        "phone": "07845 678901"},
    {"name": "Priya Patel",       "email": "priya.patel@hotmail.co.uk",    "phone": "07456 012345"},
    {"name": "Thomas Anderson",   "email": "t.anderson@outlook.com",       "phone": "07567 123456"},
    {"name": "Ella Robinson",     "email": "ellar@icloud.com",             "phone": "07678 234567"},
    {"name": "Hassan Mahmood",    "email": "hassan.m@gmail.com",           "phone": "07789 345678"},
    {"name": "Isabella Clarke",   "email": "bella.clarke@gmail.com",       "phone": "07890 456789"},
    {"name": "Kieran Murphy",     "email": "kieranmurphy@hotmail.com",     "phone": "07901 567890"},
    {"name": "Zara Khan",         "email": "zara.khan@outlook.com",        "phone": "07412 678901"},
    {"name": "Will Harrison",     "email": "willharrison@gmail.com",       "phone": "07523 789012"},
    {"name": "Lucy Bennett",      "email": "lucybennett@yahoo.co.uk",      "phone": "07634 890123"},
    {"name": "Adam Phillips",     "email": "adam.p@proton.me",             "phone": "07745 901234"},
    {"name": "Mia Roberts",       "email": "mia.roberts@gmail.com",        "phone": "07856 012345"},
    {"name": "Nathan Carter",     "email": "nathancarter@hotmail.co.uk",   "phone": "07967 123456"},
    {"name": "Chloe Evans",       "email": "chloe.evans@icloud.com",       "phone": "07412 234567"},
    {"name": "Aiden Wright",      "email": "aiden.w@gmail.com",            "phone": "07523 345678"},
    {"name": "Hannah Morris",     "email": "hannahmorris@outlook.com",     "phone": "07634 456789"},
    {"name": "Declan Kelly",      "email": "declankelly@hotmail.com",      "phone": "07745 567890"},
]

# Occasions for special bookings
OCCASIONS = [None, None, None, None, None, "Birthday", "Anniversary", "Date Night", "Business Dinner", "Celebration"]
SEATING_PREFS = [None, None, None, "Window", "Booth", "Terrace", "Quiet Corner"]
DIETARY = [[], [], [], [], ["Vegetarian"], ["Gluten Free"], ["Halal"], ["Nut Allergy"], ["Vegan", "Gluten Free"]]
NOTES = [
    None, None, None, None, None,
    "Running 10 minutes late",
    "High chair needed please",
    "Celebrating mum's 60th!",
    "Would love a window seat if possible",
    "One guest uses a wheelchair",
    "Allergic to shellfish — please flag with kitchen",
    "Quiet table preferred, business meeting",
    "Returning customers, loved it last time!",
]

# Restaurant time slots (Turkish restaurant — lunch and dinner service)
LUNCH_SLOTS = ["12:00", "12:30", "13:00", "13:30", "14:00"]
DINNER_SLOTS = ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"]

# Booking counts per day (Mon=0 ... Sun=6)
DAY_PROFILES = {
    0: {"lunch": 3, "dinner": 6},    # Monday — quiet
    1: {"lunch": 3, "dinner": 7},    # Tuesday
    2: {"lunch": 4, "dinner": 8},    # Wednesday
    3: {"lunch": 5, "dinner": 12},   # Thursday — building up
    4: {"lunch": 6, "dinner": 16},   # Friday — busy
    5: {"lunch": 8, "dinner": 18},   # Saturday — peak
    6: {"lunch": 6, "dinner": 10},   # Sunday — moderate
}


# ══════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════

def _client_id():
    return "cli_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=12))

def _booking_id(date_str, idx):
    return f"bkg_{date_str.replace('-', '')}_{BIZ_ID[:8]}_{idx:03d}"

def _time_to_mins(t):
    """Convert 'HH:MM' to minutes since midnight."""
    h, m = map(int, t.split(":"))
    return h * 60 + m

def _mins_to_time(m):
    """Convert minutes since midnight to 'HH:MM'."""
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"

def _get_occupied_slots(time_slot, duration):
    """Return all 30-min slot strings a booking covers."""
    start = _time_to_mins(time_slot)
    slots = []
    t = start
    while t < start + duration:
        slots.append(_mins_to_time(t))
        t += 30
    return slots

def pick_table_for_party(party_size, occupied_tables):
    """Pick the best available table for a party size."""
    available = [t for t in TABLES if t["id"] not in occupied_tables]
    # Find smallest table that fits
    suitable = [t for t in available if t["seats"] >= party_size]
    if suitable:
        suitable.sort(key=lambda t: t["seats"])
        return suitable[0]
    # If nothing fits perfectly, return any available
    if available:
        return max(available, key=lambda t: t["seats"])
    return None

def mark_table_occupied(day_occupied_tables, table_id, time_slot, duration):
    """Mark a table as occupied across ALL 30-min slots it covers."""
    for slot in _get_occupied_slots(time_slot, duration):
        if slot not in day_occupied_tables:
            day_occupied_tables[slot] = set()
        day_occupied_tables[slot].add(table_id)

def get_booking_status(booking_date, booking_time_str, day_offset_from_today):
    """Determine realistic status based on when the booking is relative to now."""
    now = datetime.utcnow()
    hour, minute = map(int, booking_time_str.split(":"))

    if day_offset_from_today < 0:
        # Past days — mostly completed, some no-shows/cancellations
        r = random.random()
        if r < 0.82:
            return "completed"
        elif r < 0.90:
            return "no_show"
        elif r < 0.95:
            return "cancelled"
        else:
            return "completed"

    elif day_offset_from_today == 0:
        # TODAY — the busy day
        booking_minutes = hour * 60 + minute
        now_minutes = now.hour * 60 + now.minute

        if booking_minutes < now_minutes - 90:
            # Booking was 90+ mins ago — completed
            r = random.random()
            return "no_show" if r < 0.08 else "completed"
        elif booking_minutes < now_minutes - 15:
            # Booking was 15-90 mins ago — currently seated
            return "seated"
        elif booking_minutes < now_minutes + 30:
            # Booking within next 30 mins — confirmed, about to arrive
            return "confirmed"
        else:
            # Later today
            return "confirmed"
    else:
        # Future days
        r = random.random()
        if r < 0.92:
            return "confirmed"
        elif r < 0.97:
            return "pending"
        else:
            return "cancelled"


# ══════════════════════════════════════════════
# CLEAR OLD DATA
# ══════════════════════════════════════════════

print("\n🗑️  Clearing old data for Micho...")
db.bookings.delete_many({"businessId": BIZ_ID})
db.clients.delete_many({"businessId": BIZ_ID})
db.activity_log.delete_many({"businessId": BIZ_ID})
# Also clear reservations collection (legacy)
db.reservations.delete_many({"business_id": BIZ_ID})
print("   Cleared bookings, clients, activity log, reservations")


# ══════════════════════════════════════════════
# CREATE CLIENTS
# ══════════════════════════════════════════════

print("\n👥 Creating guest clients...")
client_ids = {}
for g in GUESTS:
    cid = _client_id()
    doc = {
        "id": cid,
        "businessId": BIZ_ID,
        "name": g["name"],
        "email": g["email"],
        "phone": g["phone"],
        "phoneNormalized": g["phone"].replace(" ", ""),
        "tags": [],
        "notes": [],
        "stats": {
            "totalBookings": 0,
            "totalSpent": 0,
            "lastVisit": None,
            "firstVisit": None,
            "noShows": 0,
            "cancellations": 0,
            "averageSpend": 0,
        },
        "source": "online",
        "active": True,
        "createdAt": datetime.utcnow() - timedelta(days=random.randint(7, 90)),
        "updatedAt": datetime.utcnow(),
    }
    db.clients.insert_one(doc)
    client_ids[g["email"]] = cid

print(f"   Created {len(GUESTS)} clients")


# ══════════════════════════════════════════════
# CREATE BOOKINGS FOR THE FULL WEEK
# ══════════════════════════════════════════════

print("\n📅 Creating bookings for the week...")
all_bookings = []
today_seated = []  # Track which tables are seated TODAY
ref_counter = 1

for day_offset in range(7):
    booking_date = MONDAY + timedelta(days=day_offset)
    date_str = booking_date.strftime("%Y-%m-%d")
    day_of_week = booking_date.weekday()
    day_offset_from_today = (booking_date - TODAY).days
    profile = DAY_PROFILES[day_of_week]

    day_bookings = []
    day_occupied_tables = {}  # time_slot -> set of table_ids

    # Generate lunch bookings
    for i in range(profile["lunch"]):
        guest = random.choice(GUESTS)
        time_slot = random.choice(LUNCH_SLOTS)
        party_size = random.choice([2, 2, 2, 3, 4, 4, 5, 6])
        duration = random.choice([60, 75, 90])
        # Build set of tables occupied during ANY slot this booking would cover
        occupied = set()
        for slot in _get_occupied_slots(time_slot, duration):
            occupied |= day_occupied_tables.get(slot, set())
        table = pick_table_for_party(party_size, occupied)
        if table:
            mark_table_occupied(day_occupied_tables, table["id"], time_slot, duration)

        status = get_booking_status(booking_date, time_slot, day_offset_from_today)

        booking = {
            "_id": _booking_id(date_str, ref_counter),
            "customerId": client_ids.get(guest["email"]),
            "reference": f"REZ-{ref_counter:04d}",
            "businessId": BIZ_ID,
            "type": "restaurant",
            "status": status,
            "partySize": party_size,
            "date": date_str,
            "time": time_slot,
            "duration": duration,
            "customer": {
                "name": guest["name"],
                "phone": guest["phone"],
                "email": guest["email"],
            },
            "tableId": table["id"] if table else None,
            "tableName": table["name"] if table else None,
            "table_name": table["name"] if table else None,
            "notes": random.choice(NOTES),
            "occasion": random.choice(OCCASIONS),
            "seatingPreference": random.choice(SEATING_PREFS),
            "dietaryRequirements": random.choice(DIETARY),
            "allergens": random.choice([[], [], [], [], ["gluten"], ["nuts"], ["milk"], ["eggs", "gluten"], ["peanuts", "sesame"]]),
            "deposit": {"enabled": party_size >= 6, "amount": 5.0 * party_size if party_size >= 6 else None, "threshold": 6, "cancellationHours": 24, "stripePaymentIntentId": None, "status": "paid" if party_size >= 6 else None},
            "channel": random.choice(["online", "online", "online", "phone", "walk_in"]),
            "source": "booking_link",
            "notifications": {
                "confirmationSent": status != "pending",
                "reminderScheduled": None,
                "reminderSent": day_offset_from_today < 0,
                "reviewRequestSent": status == "completed",
            },
            "createdAt": datetime.utcnow() - timedelta(days=max(1, 7 - day_offset_from_today + random.randint(0, 3))),
            "updatedAt": datetime.utcnow(),
        }
        # Calculate endTime from time + duration
        try:
            h, m = map(int, time_slot.split(":"))
            m += booking["duration"]
            h += m // 60
            m %= 60
            booking["endTime"] = f"{h:02d}:{m:02d}"
        except:
            booking["endTime"] = time_slot

        day_bookings.append(booking)
        ref_counter += 1

        # Track seated bookings for TODAY's floor plan
        if day_offset_from_today == 0 and status == "seated" and table:
            today_seated.append({
                "table_id": table["id"],
                "guest": guest["name"],
                "party_size": party_size,
                "time": time_slot,
                "vip": random.random() < 0.15,
            })

    # Generate dinner bookings
    for i in range(profile["dinner"]):
        guest = random.choice(GUESTS)
        time_slot = random.choice(DINNER_SLOTS)
        party_size = random.choice([2, 2, 2, 2, 3, 4, 4, 4, 5, 6, 6, 8])
        duration = random.choice([75, 90, 90, 105, 120])
        # Build set of tables occupied during ANY slot this booking would cover
        occupied = set()
        for slot in _get_occupied_slots(time_slot, duration):
            occupied |= day_occupied_tables.get(slot, set())
        table = pick_table_for_party(party_size, occupied)
        if table:
            mark_table_occupied(day_occupied_tables, table["id"], time_slot, duration)

        status = get_booking_status(booking_date, time_slot, day_offset_from_today)

        booking = {
            "_id": _booking_id(date_str, ref_counter),
            "customerId": client_ids.get(guest["email"]),
            "reference": f"REZ-{ref_counter:04d}",
            "businessId": BIZ_ID,
            "type": "restaurant",
            "status": status,
            "partySize": party_size,
            "date": date_str,
            "time": time_slot,
            "duration": duration,
            "customer": {
                "name": guest["name"],
                "phone": guest["phone"],
                "email": guest["email"],
            },
            "tableId": table["id"] if table else None,
            "tableName": table["name"] if table else None,
            "table_name": table["name"] if table else None,
            "notes": random.choice(NOTES),
            "occasion": random.choice(OCCASIONS),
            "seatingPreference": random.choice(SEATING_PREFS),
            "dietaryRequirements": random.choice(DIETARY),
            "allergens": random.choice([[], [], [], [], ["gluten"], ["nuts"], ["milk", "eggs"], ["peanuts"], ["sesame", "soya"]]),
            "deposit": {"enabled": party_size >= 6, "amount": 5.0 * party_size if party_size >= 6 else None, "threshold": 6, "cancellationHours": 24, "stripePaymentIntentId": None, "status": "paid" if party_size >= 6 else None},
            "channel": random.choice(["online", "online", "online", "online", "phone", "walk_in"]),
            "source": "booking_link",
            "notifications": {
                "confirmationSent": status != "pending",
                "reminderScheduled": None,
                "reminderSent": day_offset_from_today < 0,
                "reviewRequestSent": status == "completed",
            },
            "createdAt": datetime.utcnow() - timedelta(days=max(1, 7 - day_offset_from_today + random.randint(0, 5))),
            "updatedAt": datetime.utcnow(),
        }
        # Calculate endTime
        try:
            h, m = map(int, time_slot.split(":"))
            m += booking["duration"]
            h += m // 60
            m %= 60
            booking["endTime"] = f"{h:02d}:{m:02d}"
        except:
            booking["endTime"] = time_slot

        day_bookings.append(booking)
        ref_counter += 1

        if day_offset_from_today == 0 and status == "seated" and table:
            today_seated.append({
                "table_id": table["id"],
                "guest": guest["name"],
                "party_size": party_size,
                "time": time_slot,
                "vip": random.random() < 0.15,
            })

    all_bookings.extend(day_bookings)
    day_name = booking_date.strftime("%A")
    completed = sum(1 for b in day_bookings if b["status"] == "completed")
    seated = sum(1 for b in day_bookings if b["status"] == "seated")
    confirmed = sum(1 for b in day_bookings if b["status"] == "confirmed")
    no_show = sum(1 for b in day_bookings if b["status"] == "no_show")
    cancelled = sum(1 for b in day_bookings if b["status"] == "cancelled")
    marker = " ← TODAY" if day_offset_from_today == 0 else ""
    print(f"   {day_name} {date_str}: {len(day_bookings)} bookings (✓{completed} 🪑{seated} 📋{confirmed} ✗{no_show} 🚫{cancelled}){marker}")

# Insert all bookings
if all_bookings:
    db.bookings.insert_many(all_bookings)

print(f"\n   Total: {len(all_bookings)} bookings created")


# ══════════════════════════════════════════════
# UPDATE CLIENT STATS
# ══════════════════════════════════════════════

print("\n📊 Updating client stats...")
for g in GUESTS:
    email = g["email"]
    cid = client_ids.get(email)
    if not cid:
        continue

    client_bookings = [b for b in all_bookings if b["customer"]["email"] == email]
    completed_bookings = [b for b in client_bookings if b["status"] == "completed"]
    no_shows = sum(1 for b in client_bookings if b["status"] == "no_show")
    cancellations = sum(1 for b in client_bookings if b["status"] == "cancelled")

    # Simulate spend (£15-45 per person)
    total_spent = sum(
        b["partySize"] * random.uniform(15, 45)
        for b in completed_bookings
    )
    avg_spend = total_spent / len(completed_bookings) if completed_bookings else 0

    dates = sorted([b["date"] for b in client_bookings])
    first_visit = dates[0] if dates else None
    last_visit = dates[-1] if dates else None

    # Add tags based on behaviour
    tags = []
    if len(completed_bookings) >= 3:
        tags.append("Regular")
    if total_spent > 200:
        tags.append("High Spender")
    if no_shows > 0:
        tags.append("No-Show Risk")
    if any(b.get("occasion") == "Birthday" for b in client_bookings):
        tags.append("Birthday Visitor")

    db.clients.update_one(
        {"businessId": BIZ_ID, "id": cid},
        {"$set": {
            "stats": {
                "totalBookings": len(client_bookings),
                "totalSpent": round(total_spent, 2),
                "lastVisit": last_visit,
                "firstVisit": first_visit,
                "noShows": no_shows,
                "cancellations": cancellations,
                "averageSpend": round(avg_spend, 2),
            },
            "tags": tags,
            "updatedAt": datetime.utcnow(),
        }}
    )

print(f"   Updated stats for {len(GUESTS)} clients")


# ══════════════════════════════════════════════
# UPDATE FLOOR PLAN TABLE STATUSES
# ══════════════════════════════════════════════

print("\n🪑 Updating floor plan table statuses to match today's bookings...")

# Build status map from today's bookings
today_str = TODAY.strftime("%Y-%m-%d")
today_bookings = [b for b in all_bookings if b["date"] == today_str]
now_minutes = datetime.utcnow().hour * 60 + datetime.utcnow().minute

# Determine each table's current status from live bookings
table_status_map = {}
for b in today_bookings:
    tid = b.get("tableId")
    if not tid:
        continue
    hour, minute = map(int, b["time"].split(":"))
    bk_minutes = hour * 60 + minute
    duration = b.get("duration", 90)

    if b["status"] == "seated":
        elapsed = now_minutes - bk_minutes
        timer_mins = max(1, elapsed)
        table_status_map[tid] = {
            "status": "seated",
            "guest": b["customer"]["name"],
            "timer": f"{timer_mins}m",
            "vip": b.get("occasion") in ["Birthday", "Anniversary"] or random.random() < 0.1,
        }
    elif b["status"] == "confirmed" and bk_minutes > now_minutes and bk_minutes < now_minutes + 120:
        if tid not in table_status_map or table_status_map[tid]["status"] == "available":
            table_status_map[tid] = {
                "status": "reserved",
                "guest": f"{b['customer']['name'].split()[0]} ({b['partySize']})",
                "nextTime": b["time"],
            }
    elif b["status"] == "completed" and bk_minutes > now_minutes - 30:
        if tid not in table_status_map:
            table_status_map[tid] = {"status": "dirty"}

# DEMO FALLBACK: if no active bookings (e.g. 1 AM), use realistic demo statuses
# so the floor plan always looks alive for demos and screenshots
if len(table_status_map) < 2:
    print("   No active service right now — applying demo statuses for showcase")
    # Pick guests from today's confirmed bookings for realism
    upcoming = [b for b in today_bookings if b["status"] == "confirmed"]
    table_status_map = {
        "t1": {"status": "seated", "guest": upcoming[0]["customer"]["name"] if len(upcoming) > 0 else "Sarah Mitchell", "timer": "45m", "vip": False},
        "t2": {"status": "reserved", "guest": f"{upcoming[1]['customer']['name'].split()[0]} ({upcoming[1]['partySize']})" if len(upcoming) > 1 else "Smith (4)", "nextTime": "19:00"},
        "t3": {"status": "available"},
        "t4": {"status": "seated", "guest": upcoming[2]["customer"]["name"] if len(upcoming) > 2 else "Mohammed Ali", "timer": "12m", "vip": True},
        "t5": {"status": "dirty"},
        "t6": {"status": "mains", "guest": upcoming[3]["customer"]["name"] if len(upcoming) > 3 else "Williams"},
    }

# Apply to floor plan elements
fp = micho.get("floor_plan", {})
elements = fp.get("elements", [])

if elements:
    for el in elements:
        if el.get("type") == "fixture":
            continue
        tid = el.get("id")
        if tid in table_status_map:
            s = table_status_map[tid]
            el["status"] = s.get("status", "available")
            el["guest"] = s.get("guest", "")
            el["timer"] = s.get("timer", "")
            el["nextTime"] = s.get("nextTime", "")
            el["vip"] = s.get("vip", False)
        # DON'T overwrite tables not in the map — leave their existing status alone

    db.businesses.update_one(
        {"_id": micho["_id"]},
        {"$set": {
            "floor_plan.elements": elements,
            "floor_plan.width": fp.get("width", 1000),
            "floor_plan.height": fp.get("height", 800),
        }}
    )
    print(f"   Updated {len(table_status_map)} table statuses")
    for tid, s in table_status_map.items():
        tname = next((t["name"] for t in TABLES if t["id"] == tid), tid)
        print(f"     {tname}: {s.get('status', '?')}" + (f" — {s.get('guest', '')}" if s.get("guest") else ""))
else:
    print("   ⚠️  No floor plan elements found — run reset_floor_plan.py first")


# ══════════════════════════════════════════════
# CREATE ACTIVITY LOG
# ══════════════════════════════════════════════

print("\n📋 Creating activity log...")
activity_entries = []
for b in all_bookings:
    cust_name = b["customer"]["name"]
    activity_entries.append({
        "businessId": BIZ_ID,
        "type": "booking_created",
        "message": f"New booking: {cust_name} — Party of {b['partySize']}, {b['date']} at {b['time']}",
        "bookingId": b["_id"],
        "timestamp": b["createdAt"],
    })

    if b["status"] == "confirmed":
        activity_entries.append({
            "businessId": BIZ_ID,
            "type": "booking_confirmed",
            "message": f"Booking confirmed: {cust_name} — {b['date']} at {b['time']}",
            "bookingId": b["_id"],
            "timestamp": b["createdAt"] + timedelta(seconds=random.randint(5, 30)),
        })
    elif b["status"] == "completed":
        activity_entries.append({
            "businessId": BIZ_ID,
            "type": "booking_completed",
            "message": f"Visit completed: {cust_name} — Party of {b['partySize']}",
            "bookingId": b["_id"],
            "timestamp": datetime.combine(
                datetime.strptime(b["date"], "%Y-%m-%d").date(),
                datetime.strptime(b["time"], "%H:%M").time()
            ) + timedelta(minutes=b.get("duration", 90)),
        })
    elif b["status"] == "no_show":
        activity_entries.append({
            "businessId": BIZ_ID,
            "type": "booking_no_show",
            "message": f"No-show: {cust_name} — {b['date']} at {b['time']} (Party of {b['partySize']})",
            "bookingId": b["_id"],
            "timestamp": datetime.combine(
                datetime.strptime(b["date"], "%Y-%m-%d").date(),
                datetime.strptime(b["time"], "%H:%M").time()
            ) + timedelta(minutes=20),
        })

if activity_entries:
    db.activity_log.insert_many(activity_entries)
print(f"   Created {len(activity_entries)} activity log entries")


# ══════════════════════════════════════════════
# ADD STAFF
# ══════════════════════════════════════════════

print("\n👨‍🍳 Adding staff members...")
staff = [
    {"id": "staff_owner", "name": "Sadkine Krizilkaya", "role": "Owner", "email": "sadkine@michoturkishbarandgrill.co.uk", "active": True, "pin": "1234"},
    {"id": "staff_mgr", "name": "Serhat", "role": "Floor Manager", "email": "serhat@michoturkishbarandgrill.co.uk", "active": True, "pin": "5678"},
    {"id": "staff_wait1", "name": "Yaren Krizilkaya", "role": "Waitress", "email": "yaren@michoturkishbarandgrill.co.uk", "active": True, "pin": "3456"},
]
db.businesses.update_one(
    {"_id": micho["_id"]},
    {"$set": {"staff": staff}}
)
print(f"   Added {len(staff)} staff members")


# ══════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════

today_count = len(today_bookings)
today_seated_count = sum(1 for b in today_bookings if b["status"] == "seated")
today_confirmed = sum(1 for b in today_bookings if b["status"] == "confirmed")
today_completed = sum(1 for b in today_bookings if b["status"] == "completed")

print(f"""
═══════════════════════════════════════════════
✅ SEED COMPLETE — Micho Turkish Bar & Grill
═══════════════════════════════════════════════

📅 Week: {MONDAY.strftime('%a %d %b')} → {(MONDAY + timedelta(days=6)).strftime('%a %d %b %Y')}
📊 Total bookings: {len(all_bookings)}
👥 Unique guests: {len(GUESTS)}
👨‍🍳 Staff: {len(staff)}
📋 Activity log: {len(activity_entries)} entries

🎯 TODAY ({TODAY.strftime('%A %d %b')}):
   {today_count} bookings total
   {today_completed} completed | {today_seated_count} seated now | {today_confirmed} upcoming | {sum(1 for b in today_bookings if b['status'] == 'no_show')} no-shows

🪑 Floor plan live:
   {len(table_status_map)} tables have active statuses
   {today_seated_count} diners currently seated

🔗 Refresh portal.rezvo.app to see everything live!
""")
