"""
Seed 6 months of realistic data for Micho Turkish Bar & Grill, Sheffield.
Run on VPS:  cd /opt/rezvo-app && python3 -m backend.scripts.seed_micho_6months
Or directly:  cd /opt/rezvo-app/backend && python3 scripts/seed_micho_6months.py

Collections seeded:
  - businesses (update staff array)
  - bookings (businessId)
  - clients (businessId)
  - reviews (business_id for direct, businessId for scoped)
  - orders (business_id)
  - notifications (business_id)
  - activity_log (businessId)
"""
import asyncio
import random
import hashlib
from datetime import datetime, timedelta, date, time
from bson import ObjectId

# ─── Config ─── #
MONTHS_BACK = 6
TODAY = date.today()
START_DATE = TODAY - timedelta(days=MONTHS_BACK * 30)

# ─── Micho Staff ─── #
STAFF = [
    {"id": "staff_sadkine", "name": "Sadkine Krizilkaya", "email": "sadkine@micho.co.uk", "phone": "+44 7700 100001", "role": "Owner", "color": "#C9A84C"},
    {"id": "staff_serhat", "name": "Serhat", "email": "serhat@micho.co.uk", "phone": "+44 7700 100002", "role": "Floor Manager", "color": "#4A90D9"},
    {"id": "staff_yaren", "name": "Yaren Krizilkaya", "email": "yaren@micho.co.uk", "phone": "+44 7700 100003", "role": "Waitress", "color": "#D97B6B"},
    {"id": "staff_ali", "name": "Ali Demir", "email": "ali@micho.co.uk", "phone": "+44 7700 100004", "role": "Head Chef", "color": "#6BAF6B"},
    {"id": "staff_mehmet", "name": "Mehmet Yilmaz", "email": "mehmet@micho.co.uk", "phone": "+44 7700 100005", "role": "Sous Chef", "color": "#9B6BB0"},
]

DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

def make_staff_entry(s):
    wh = {}
    for d in DAYS_OF_WEEK:
        if s["role"] in ("Owner",):
            wh[d] = {"active": d not in ("sun",), "start": "10:00", "end": "23:00"}
        elif s["role"] in ("Head Chef", "Sous Chef"):
            wh[d] = {"active": d not in ("mon",), "start": "11:00", "end": "23:00"}
        else:
            wh[d] = {"active": d not in ("mon", "tue"), "start": "12:00", "end": "23:00"}
    return {
        **s,
        "active": True,
        "workingHours": wh,
        "createdAt": (TODAY - timedelta(days=200)).isoformat(),
    }

# ─── Menu Items ─── #
MENU = {
    "Starters": [
        ("Hummus & Warm Pide", 6.50), ("Cacik", 5.50), ("Ezme Salad", 5.95),
        ("Sigara Boregi", 7.50), ("Grilled Halloumi", 7.95), ("Falafel (6 pcs)", 6.95),
        ("Babaganoush", 6.50), ("Mixed Meze Platter", 14.95), ("Sucuk (Spicy Sausage)", 7.50),
        ("Soup of the Day", 5.50),
    ],
    "Mains": [
        ("Mixed Grill for 2", 38.95), ("Adana Kebab", 15.95), ("Chicken Shish", 14.95),
        ("Lamb Shish", 16.95), ("Iskender Kebab", 16.50), ("Beyti Wrap", 15.50),
        ("Lamb Kofte", 14.50), ("Moussaka", 13.95), ("Tavuk Kanat (Wings)", 12.95),
        ("Grilled Sea Bass", 17.95), ("Chicken Beyti", 14.95), ("Lamb Chops (4 pcs)", 18.95),
        ("Pide (Cheese & Spinach)", 12.50), ("Pide (Lamb Mince)", 13.50),
        ("Vegetable Moussaka", 12.95),
    ],
    "Desserts": [
        ("Baklava (4 pcs)", 6.95), ("Kunefe", 8.95), ("Sutlac (Rice Pudding)", 5.95),
        ("Turkish Delight Selection", 4.95), ("Chocolate Fondant", 7.50),
    ],
    "Drinks": [
        ("Turkish Tea", 2.50), ("Ayran", 3.00), ("Turkish Coffee", 3.50),
        ("Efes Pilsener", 5.50), ("House Red Wine (175ml)", 6.50),
        ("House White Wine (175ml)", 6.50), ("Raki (50ml)", 7.50),
        ("Soft Drink", 3.00), ("Fresh Orange Juice", 4.50), ("Sparkling Water", 2.95),
    ],
}

ALL_ITEMS = []
for cat, items in MENU.items():
    for name, price in items:
        ALL_ITEMS.append({"name": name, "price": price, "category": cat})

# ─── Customer Names (UK realistic mix with Turkish/Sheffield) ─── #
CUSTOMERS = [
    {"name": "James Harrison", "email": "james.harrison@gmail.com", "phone": "+44 7911 234001"},
    {"name": "Sophie Turner", "email": "sophie.t@outlook.com", "phone": "+44 7911 234002"},
    {"name": "Mohammed Khan", "email": "mkhan@hotmail.co.uk", "phone": "+44 7911 234003"},
    {"name": "Emily Watson", "email": "emily.watson@yahoo.co.uk", "phone": "+44 7911 234004"},
    {"name": "David Chambers", "email": "d.chambers@gmail.com", "phone": "+44 7911 234005"},
    {"name": "Priya Patel", "email": "priya.patel@gmail.com", "phone": "+44 7911 234006"},
    {"name": "Tom Bradshaw", "email": "tom.bradshaw@btinternet.com", "phone": "+44 7911 234007"},
    {"name": "Olivia Green", "email": "olivia.green@gmail.com", "phone": "+44 7911 234008"},
    {"name": "Ahmet Ozkan", "email": "ahmet.ozkan@gmail.com", "phone": "+44 7911 234009"},
    {"name": "Rachel Morris", "email": "rachel.m@outlook.com", "phone": "+44 7911 234010"},
    {"name": "Chris Taylor", "email": "chris.taylor@gmail.com", "phone": "+44 7911 234011"},
    {"name": "Fatima Al-Rashid", "email": "fatima.ar@hotmail.com", "phone": "+44 7911 234012"},
    {"name": "Ben Walker", "email": "ben.walker@gmail.com", "phone": "+44 7911 234013"},
    {"name": "Elif Yildiz", "email": "elif.y@gmail.com", "phone": "+44 7911 234014"},
    {"name": "Lucy Campbell", "email": "lucy.c@yahoo.co.uk", "phone": "+44 7911 234015"},
    {"name": "Mark Stevens", "email": "mark.stevens@outlook.com", "phone": "+44 7911 234016"},
    {"name": "Zara Hussain", "email": "zara.h@gmail.com", "phone": "+44 7911 234017"},
    {"name": "Daniel Cooper", "email": "dan.cooper@gmail.com", "phone": "+44 7911 234018"},
    {"name": "Hannah Reid", "email": "hannah.reid@outlook.com", "phone": "+44 7911 234019"},
    {"name": "Kemal Arslan", "email": "kemal.arslan@gmail.com", "phone": "+44 7911 234020"},
    {"name": "Sarah Mitchell", "email": "sarah.m@gmail.com", "phone": "+44 7911 234021"},
    {"name": "Ryan Brooks", "email": "ryan.brooks@gmail.com", "phone": "+44 7911 234022"},
    {"name": "Amelia Clarke", "email": "amelia.c@yahoo.co.uk", "phone": "+44 7911 234023"},
    {"name": "Jack Robertson", "email": "jack.r@outlook.com", "phone": "+44 7911 234024"},
    {"name": "Nadia Celik", "email": "nadia.celik@gmail.com", "phone": "+44 7911 234025"},
    {"name": "George Foster", "email": "george.f@btinternet.com", "phone": "+44 7911 234026"},
    {"name": "Isla Thompson", "email": "isla.t@gmail.com", "phone": "+44 7911 234027"},
    {"name": "Sam Wilson", "email": "sam.wilson@outlook.com", "phone": "+44 7911 234028"},
    {"name": "Deniz Kaya", "email": "deniz.kaya@gmail.com", "phone": "+44 7911 234029"},
    {"name": "Charlotte Evans", "email": "charlotte.e@gmail.com", "phone": "+44 7911 234030"},
    {"name": "Will Parker", "email": "will.parker@yahoo.co.uk", "phone": "+44 7911 234031"},
    {"name": "Aisha Begum", "email": "aisha.b@hotmail.co.uk", "phone": "+44 7911 234032"},
    {"name": "Pete Dixon", "email": "pete.dixon@gmail.com", "phone": "+44 7911 234033"},
    {"name": "Megan Kelly", "email": "megan.k@outlook.com", "phone": "+44 7911 234034"},
    {"name": "Ozgur Taskin", "email": "ozgur.t@gmail.com", "phone": "+44 7911 234035"},
    {"name": "Emma Richardson", "email": "emma.r@gmail.com", "phone": "+44 7911 234036"},
    {"name": "Harry Phillips", "email": "harry.p@outlook.com", "phone": "+44 7911 234037"},
    {"name": "Leyla Polat", "email": "leyla.polat@gmail.com", "phone": "+44 7911 234038"},
    {"name": "Oliver Bennett", "email": "ollie.b@gmail.com", "phone": "+44 7911 234039"},
    {"name": "Katie Morgan", "email": "katie.m@yahoo.co.uk", "phone": "+44 7911 234040"},
    {"name": "Burak Sahin", "email": "burak.s@gmail.com", "phone": "+44 7911 234041"},
    {"name": "Jessica Wright", "email": "jess.wright@outlook.com", "phone": "+44 7911 234042"},
    {"name": "Nathan Shaw", "email": "nathan.shaw@gmail.com", "phone": "+44 7911 234043"},
    {"name": "Grace Edwards", "email": "grace.e@gmail.com", "phone": "+44 7911 234044"},
    {"name": "Emre Dogan", "email": "emre.dogan@gmail.com", "phone": "+44 7911 234045"},
    {"name": "Alice Howard", "email": "alice.h@gmail.com", "phone": "+44 7911 234046"},
    {"name": "Max Turner", "email": "max.turner@outlook.com", "phone": "+44 7911 234047"},
    {"name": "Yasmin Shah", "email": "yasmin.shah@gmail.com", "phone": "+44 7911 234048"},
    {"name": "Liam Murphy", "email": "liam.murphy@gmail.com", "phone": "+44 7911 234049"},
    {"name": "Chloe Baker", "email": "chloe.baker@yahoo.co.uk", "phone": "+44 7911 234050"},
    {"name": "Selin Erdogan", "email": "selin.e@gmail.com", "phone": "+44 7911 234051"},
    {"name": "Callum Price", "email": "callum.p@outlook.com", "phone": "+44 7911 234052"},
    {"name": "Ruby Marshall", "email": "ruby.m@gmail.com", "phone": "+44 7911 234053"},
    {"name": "Hasan Aydin", "email": "hasan.aydin@gmail.com", "phone": "+44 7911 234054"},
    {"name": "Poppy Collins", "email": "poppy.c@outlook.com", "phone": "+44 7911 234055"},
    {"name": "Scott Reynolds", "email": "scott.r@gmail.com", "phone": "+44 7911 234056"},
    {"name": "Laura Hughes", "email": "laura.h@yahoo.co.uk", "phone": "+44 7911 234057"},
    {"name": "Canan Demir", "email": "canan.d@gmail.com", "phone": "+44 7911 234058"},
    {"name": "Adam Fletcher", "email": "adam.fletcher@gmail.com", "phone": "+44 7911 234059"},
    {"name": "Beth Sullivan", "email": "beth.s@outlook.com", "phone": "+44 7911 234060"},
]

# ─── Review templates ─── #
REVIEW_TEXTS = {
    5: [
        "Absolutely fantastic! The Mixed Grill was incredible and the service from {staff} was top notch.",
        "Best Turkish food in Sheffield by far. The Adana Kebab was perfect, cooked exactly right.",
        "Lovely atmosphere, great food, amazing service. We'll definitely be back!",
        "Had the Kunefe for dessert — genuinely the best I've had outside Istanbul.",
        "Brought the family here for a birthday meal. Every dish was spot on, especially the lamb.",
        "Hidden gem! The Meze Platter was generous and fresh. Staff were incredibly warm and welcoming.",
        "We're regulars now. Consistently great quality. The Iskender is my go-to every time.",
        "Perfect date night spot. The Raki with the Beyti was a brilliant combo. Thank you {staff}!",
    ],
    4: [
        "Really good food, portions were generous. Service was friendly, just a little wait for mains.",
        "Lovely Turkish restaurant. The Chicken Shish was very tasty. Would give 5 but parking is tricky.",
        "Great meat quality and the pide bread was delicious. Nice touch with the complimentary tea.",
        "Solid Turkish food. Not the fanciest place but the food more than makes up for it.",
        "Enjoyed the Lamb Kofte. Good value for money. Will come back to try the Mixed Grill.",
    ],
    3: [
        "Food was decent but nothing special. The Halloumi was a bit too salty for my taste.",
        "Okay experience. The main was good but we waited quite a long time on a busy Saturday.",
        "Average Turkish food. I've had better Adana elsewhere but the desserts were nice.",
    ],
    2: [
        "Disappointing visit. Food was cold when it arrived and had to wait 40 minutes.",
        "Not great this time. Ordered the Mixed Grill and the chicken was overcooked.",
    ],
}

# ─── Occasions ─── #
OCCASIONS = [None, None, None, None, None, None, "Birthday", "Anniversary", "Business Dinner", "Date Night", "Family Gathering", "Celebration"]
SOURCES = ["reeveos", "reeveos", "reeveos", "phone", "phone", "walk_in", "google"]
TABLES = ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08", "T-09", "T-10", "T-11", "T-12"]
TIME_SLOTS = ["12:00", "12:30", "13:00", "13:30", "14:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"]
SERVICE_STAFF = ["staff_serhat", "staff_yaren"]

# ─── Helpers ─── #
def pick_items(party_size):
    """Pick realistic items for a table."""
    items = []
    # Everyone gets a main
    for _ in range(party_size):
        main = random.choice(MENU["Mains"])
        items.append({"name": main[0], "unit_price": main[1], "quantity": 1, "category": "Mains"})
    # 60% chance of starters
    if random.random() < 0.6:
        num_starters = random.randint(1, max(1, party_size // 2))
        for _ in range(num_starters):
            s = random.choice(MENU["Starters"])
            items.append({"name": s[0], "unit_price": s[1], "quantity": 1, "category": "Starters"})
    # 40% chance of desserts
    if random.random() < 0.4:
        num_desserts = random.randint(1, max(1, party_size // 2))
        for _ in range(num_desserts):
            d = random.choice(MENU["Desserts"])
            items.append({"name": d[0], "unit_price": d[1], "quantity": 1, "category": "Desserts"})
    # Drinks for everyone
    for _ in range(party_size):
        dr = random.choice(MENU["Drinks"])
        items.append({"name": dr[0], "unit_price": dr[1], "quantity": 1, "category": "Drinks"})
    return items

def day_bookings_count(d):
    """Realistic booking count per day."""
    dow = d.weekday()
    if dow == 0:  # Monday (closed or quiet)
        return random.randint(0, 3)
    elif dow in (1, 2, 3):  # Tue-Thu
        return random.randint(4, 10)
    elif dow == 4:  # Friday
        return random.randint(8, 16)
    elif dow == 5:  # Saturday
        return random.randint(10, 18)
    else:  # Sunday
        return random.randint(6, 12)


async def main():
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    
    import database
    from database import get_database
    
    await database.connect_to_mongo()
    db = get_database()
    
    # ─── Find Micho ─── #
    micho = await db.businesses.find_one({"slug": "micho"})
    if not micho:
        micho = await db.businesses.find_one({"name": {"$regex": "micho", "$options": "i"}})
    if not micho:
        print("❌ Micho business not found. Available businesses:")
        async for biz in db.businesses.find({}, {"name": 1, "slug": 1}):
            print(f"  - {biz.get('name')} (slug: {biz.get('slug')}, id: {biz['_id']})")
        return
    
    biz_id = str(micho["_id"])
    print(f"✅ Found Micho: {micho.get('name')} (ID: {biz_id})")
    
    # ─── 1. Update Staff ─── #
    print("\n📋 Updating staff...")
    staff_entries = [make_staff_entry(s) for s in STAFF]
    await db.businesses.update_one(
        {"_id": micho["_id"]},
        {"$set": {"staff": staff_entries}}
    )
    print(f"  ✅ {len(staff_entries)} staff members set")
    
    # ─── 2. Seed Clients ─── #
    print("\n👥 Seeding clients...")
    await db.clients.delete_many({"businessId": {"$in": [biz_id, micho["_id"]]}})
    
    client_docs = []
    client_map = {}  # email -> client_id
    for i, c in enumerate(CUSTOMERS):
        cid = str(ObjectId())
        first_visit = START_DATE + timedelta(days=random.randint(0, 60))
        visits = random.randint(1, 12)
        avg_spend = round(random.uniform(25, 85), 2)
        no_shows = 1 if random.random() < 0.08 else 0
        
        tags = []
        if visits >= 6:
            tags.append("Regular")
        if avg_spend > 65:
            tags.append("High Value")
        if visits == 1:
            tags.append("New")
        if no_shows > 0:
            tags.append("No-Show Risk")
        if random.random() < 0.1:
            tags.append("VIP")
        
        preferences = []
        if random.random() < 0.15:
            preferences.append("Vegetarian")
        if random.random() < 0.08:
            preferences.append("Gluten Free")
        if random.random() < 0.1:
            preferences.append("Nut Allergy")
        if random.random() < 0.15:
            preferences.append("Window Seat")
        if random.random() < 0.1:
            preferences.append("Booth Preferred")
        
        doc = {
            "_id": cid,
            "businessId": biz_id,
            "name": c["name"],
            "email": c["email"],
            "phone": c["phone"],
            "tags": tags,
            "preferences": preferences,
            "notes": "",
            "totalVisits": visits,
            "totalSpend": round(visits * avg_spend, 2),
            "avgSpend": avg_spend,
            "noShows": no_shows,
            "firstVisit": first_visit.isoformat(),
            "lastVisit": (TODAY - timedelta(days=random.randint(0, 30))).isoformat(),
            "active": True,
            "createdAt": first_visit.isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }
        client_docs.append(doc)
        client_map[c["email"]] = cid
    
    if client_docs:
        await db.clients.insert_many(client_docs)
    print(f"  ✅ {len(client_docs)} clients created")
    
    # ─── 3. Seed Bookings + Orders + Activity Log ─── #
    print("\n📅 Seeding bookings, orders, and activity log...")
    await db.bookings.delete_many({"businessId": {"$in": [biz_id, micho["_id"]]}})
    await db.orders.delete_many({"business_id": {"$in": [biz_id, str(micho["_id"])]}})
    await db.activity_log.delete_many({"businessId": {"$in": [biz_id, str(micho["_id"])]}})
    
    booking_docs = []
    order_docs = []
    activity_docs = []
    order_number = 1000
    total_revenue = 0
    
    current = START_DATE
    while current <= TODAY:
        n = day_bookings_count(current)
        day_str = current.isoformat()
        
        for _ in range(n):
            cust = random.choice(CUSTOMERS)
            party = random.choices([1, 2, 2, 2, 3, 4, 4, 5, 6, 8], k=1)[0]
            slot = random.choice(TIME_SLOTS)
            table = random.choice(TABLES)
            staff_id = random.choice(SERVICE_STAFF)
            staff_name = next((s["name"] for s in STAFF if s["id"] == staff_id), "Serhat")
            source = random.choice(SOURCES)
            occasion = random.choice(OCCASIONS)
            duration = random.choice([60, 75, 90, 90, 120])
            
            # Status based on date
            if current < TODAY:
                status_weights = [("completed", 0.72), ("cancelled", 0.08), ("no_show", 0.04), ("confirmed", 0.16)]
            elif current == TODAY:
                status_weights = [("confirmed", 0.5), ("checked_in", 0.2), ("completed", 0.2), ("pending", 0.1)]
            else:
                status_weights = [("confirmed", 0.7), ("pending", 0.3)]
            
            status = random.choices([s[0] for s in status_weights], [s[1] for s in status_weights], k=1)[0]
            
            # Price from items
            items = pick_items(party)
            order_total = round(sum(i["unit_price"] * i["quantity"] for i in items), 2)
            
            booking_id = str(ObjectId())
            created_at = datetime.combine(current - timedelta(days=random.randint(0, 7)), time(random.randint(8, 20), random.randint(0, 59)))
            
            booking = {
                "_id": booking_id,
                "businessId": biz_id,
                "customer": {
                    "name": cust["name"],
                    "phone": cust["phone"],
                    "email": cust["email"],
                },
                "date": day_str,
                "time": slot,
                "partySize": party,
                "tableId": table,
                "tableName": table,
                "staffId": staff_id,
                "duration": duration,
                "status": status,
                "source": source,
                "occasion": occasion,
                "notes": f"Party of {party}" + (f" — {occasion}" if occasion else ""),
                "service": {"name": f"Table for {party}", "duration": duration, "price": order_total},
                "tags": [occasion] if occasion else [],
                "price": order_total,
                "isVip": False,
                "createdAt": created_at,
                "updatedAt": datetime.combine(current, time(int(slot.split(":")[0]), int(slot.split(":")[1]))).isoformat(),
            }
            booking_docs.append(booking)
            
            # Create matching order for completed/checked_in bookings
            if status in ("completed", "checked_in"):
                order_number += 1
                order_items = []
                for item in items:
                    order_items.append({
                        "menu_item_id": hashlib.md5(item["name"].encode()).hexdigest()[:12],
                        "name": item["name"],
                        "quantity": item["quantity"],
                        "unit_price": item["unit_price"],
                        "modifiers": [],
                        "notes": None,
                        "course": 1 if item["category"] == "Starters" else 2 if item["category"] == "Mains" else 3 if item["category"] == "Desserts" else 0,
                        "fired": True,
                        "line_total": round(item["unit_price"] * item["quantity"], 2),
                    })
                
                tip = round(order_total * random.choice([0, 0, 0, 0.05, 0.10, 0.10, 0.12, 0.15]), 2)
                vat = round(order_total - (order_total / 1.2), 2)
                
                order_ts = datetime.combine(current, time(int(slot.split(":")[0]), int(slot.split(":")[1])))
                
                order = {
                    "business_id": biz_id,
                    "order_type": "dine_in",
                    "order_number": f"ORD-{order_number:05d}",
                    "table_id": table,
                    "table_number": table,
                    "covers": party,
                    "items": order_items,
                    "discounts": [],
                    "payments": [{
                        "method": random.choice(["card", "card", "card", "cash", "apple_pay"]),
                        "amount": order_total,
                        "tip": tip,
                        "reference": f"PAY-{random.randint(100000, 999999)}",
                    }],
                    "splits": None,
                    "status": "closed",
                    "customer_name": cust["name"],
                    "customer_email": cust["email"],
                    "staff_id": staff_id,
                    "notes": booking.get("notes"),
                    "service_charge_percent": 0,
                    "subtotal": order_total,
                    "discount_total": 0,
                    "vat_amount": vat,
                    "net_amount": order_total,
                    "service_charge": 0,
                    "total": order_total,
                    "tips": tip,
                    "grand_total": round(order_total + tip, 2),
                    "amount_paid": round(order_total + tip, 2),
                    "amount_due": 0,
                    "opened_at": order_ts,
                    "fired_at": order_ts + timedelta(minutes=2),
                    "closed_at": order_ts + timedelta(minutes=duration),
                    "created_at": order_ts,
                    "updated_at": order_ts + timedelta(minutes=duration),
                }
                order_docs.append(order)
                total_revenue += order_total
            
            # Activity log entry
            activity_docs.append({
                "businessId": biz_id,
                "type": "booking_" + ("created" if status in ("confirmed", "pending") else status),
                "title": f"{'New booking' if status in ('confirmed', 'pending') else status.replace('_', ' ').title()}: {cust['name']}",
                "description": f"Party of {party} at {slot}" + (f" — {occasion}" if occasion else ""),
                "timestamp": created_at,
                "metadata": {"bookingId": booking_id, "customerName": cust["name"]},
            })
        
        current += timedelta(days=1)
    
    # Batch insert
    if booking_docs:
        await db.bookings.insert_many(booking_docs)
    if order_docs:
        await db.orders.insert_many(order_docs)
    if activity_docs:
        await db.activity_log.insert_many(activity_docs)
    
    print(f"  ✅ {len(booking_docs)} bookings")
    print(f"  ✅ {len(order_docs)} orders")
    print(f"  ✅ {len(activity_docs)} activity log entries")
    print(f"  💰 Total revenue: £{total_revenue:,.2f}")
    
    # ─── 4. Seed Reviews ─── #
    print("\n⭐ Seeding reviews...")
    await db.reviews.delete_many({"business_id": {"$in": [biz_id, str(micho["_id"])]}})
    
    review_docs = []
    reviewers = random.sample(CUSTOMERS, min(35, len(CUSTOMERS)))
    
    for cust in reviewers:
        rating = random.choices([5, 4, 3, 2], weights=[45, 30, 15, 10], k=1)[0]
        texts = REVIEW_TEXTS.get(rating, REVIEW_TEXTS[3])
        text = random.choice(texts).replace("{staff}", random.choice(["Serhat", "Yaren", "the team"]))
        
        review_date = START_DATE + timedelta(days=random.randint(10, (TODAY - START_DATE).days))
        
        has_reply = random.random() < 0.6 and rating >= 3
        
        doc = {
            "business_id": biz_id,
            "businessId": biz_id,
            "user_id": client_map.get(cust["email"], str(ObjectId())),
            "user_name": cust["name"],
            "rating": rating,
            "body": text,
            "categories": [random.choice(["Food", "Service", "Atmosphere", "Value"])],
            "photos": [],
            "helpful_count": random.randint(0, 8),
            "source": random.choice(["ReeveOS", "ReeveOS", "Google"]),
            "created_at": datetime.combine(review_date, time(random.randint(10, 22), random.randint(0, 59))),
            "updated_at": datetime.combine(review_date, time(random.randint(10, 22), random.randint(0, 59))),
        }
        
        if has_reply:
            replies = [
                "Thank you so much for your kind words! We look forward to welcoming you back. — Sadkine",
                "So glad you enjoyed your meal with us! Your feedback means a lot to the whole team.",
                "Thank you for dining with us. We appreciate the lovely review!",
                "We're thrilled you had a great experience! See you again soon. — The Micho Team",
            ]
            doc["owner_reply"] = random.choice(replies)
            doc["owner_reply_at"] = doc["created_at"] + timedelta(days=random.randint(0, 3))
            doc["owner_reply_by"] = "staff_sadkine"
        
        review_docs.append(doc)
    
    if review_docs:
        await db.reviews.insert_many(review_docs)
    
    # Update business rating
    avg_rating = round(sum(r["rating"] for r in review_docs) / len(review_docs), 1) if review_docs else 0
    await db.businesses.update_one(
        {"_id": micho["_id"]},
        {"$set": {"rating": avg_rating, "review_count": len(review_docs)}}
    )
    print(f"  ✅ {len(review_docs)} reviews (avg: {avg_rating})")
    
    # ─── 5. Seed Notifications ─── #
    print("\n🔔 Seeding recent notifications...")
    await db.notifications.delete_many({"business_id": {"$in": [biz_id, str(micho["_id"])]}})
    
    notif_docs = []
    # Recent booking notifications
    recent_bookings = [b for b in booking_docs if b["date"] >= (TODAY - timedelta(days=3)).isoformat()]
    for b in recent_bookings[:20]:
        notif_docs.append({
            "business_id": biz_id,
            "title": f"New booking: {b['customerName']}",
            "body": f"Party of {b['partySize']} at {b['time']} on {b['date']}",
            "category": "bookings",
            "priority": "normal",
            "read": random.random() < 0.5,
            "dismissed": False,
            "link": "/dashboard/bookings",
            "data": {"bookingId": b["_id"]},
            "created_at": b["created_at"] if isinstance(b["created_at"], datetime) else datetime.fromisoformat(str(b["created_at"])),
        })
    
    # System notifications
    notif_docs.append({
        "business_id": biz_id,
        "title": "Weekly summary ready",
        "body": f"You had {len([b for b in booking_docs if (TODAY - timedelta(days=7)).isoformat() <= b['date'] <= TODAY.isoformat()])} bookings this week.",
        "category": "system",
        "priority": "low",
        "read": False,
        "dismissed": False,
        "created_at": datetime.combine(TODAY, time(8, 0)),
    })
    notif_docs.append({
        "business_id": biz_id,
        "title": "New 5-star review!",
        "body": "A customer left a 5-star review. Reply to thank them!",
        "category": "reviews",
        "priority": "normal",
        "read": False,
        "dismissed": False,
        "link": "/dashboard/reviews",
        "created_at": datetime.combine(TODAY - timedelta(days=1), time(14, 30)),
    })
    
    if notif_docs:
        await db.notifications.insert_many(notif_docs)
    print(f"  ✅ {len(notif_docs)} notifications")
    
    # ─── 6. Update business stats ─── #
    print("\n📊 Updating business aggregate stats...")
    completed_count = len([b for b in booking_docs if b["status"] == "completed"])
    cancelled_count = len([b for b in booking_docs if b["status"] == "cancelled"])
    no_show_count = len([b for b in booking_docs if b["status"] == "no_show"])
    
    await db.businesses.update_one(
        {"_id": micho["_id"]},
        {"$set": {
            "stats": {
                "total_bookings": len(booking_docs),
                "completed_bookings": completed_count,
                "cancelled_bookings": cancelled_count,
                "no_shows": no_show_count,
                "total_revenue": round(total_revenue, 2),
                "total_orders": len(order_docs),
                "total_clients": len(client_docs),
                "total_reviews": len(review_docs),
                "avg_rating": avg_rating,
                "last_updated": datetime.utcnow().isoformat(),
            }
        }}
    )
    
    # ─── Summary ─── #
    print("\n" + "=" * 60)
    print("🎉 MICHO SEED COMPLETE")
    print("=" * 60)
    print(f"  Business:       {micho.get('name')} ({biz_id})")
    print(f"  Period:         {START_DATE} → {TODAY} ({(TODAY - START_DATE).days} days)")
    print(f"  Staff:          {len(staff_entries)}")
    print(f"  Clients:        {len(client_docs)}")
    print(f"  Bookings:       {len(booking_docs)}")
    print(f"  Orders:         {len(order_docs)}")
    print(f"  Reviews:        {len(review_docs)} (avg {avg_rating}★)")
    print(f"  Notifications:  {len(notif_docs)}")
    print(f"  Activity Log:   {len(activity_docs)}")
    print(f"  Total Revenue:  £{total_revenue:,.2f}")
    print(f"\n  Now restart backend: systemctl restart rezvo-backend")
    print(f"  Then hard-refresh: Ctrl+Shift+R")


if __name__ == "__main__":
    asyncio.run(main())
