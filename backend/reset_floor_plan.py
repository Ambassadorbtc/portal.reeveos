"""
One-time migration: Reset floor plan to rich demo defaults.
Restores colored statuses, guest names, timers, VIP badges, and all fixtures.
"""
from pymongo import MongoClient

DEFAULT_ELEMENTS = [
    # Main Floor — Tables (with varied statuses for visual demo)
    {"id": "t1", "type": "table", "name": "T-01", "seats": 4, "zone": "main", "shape": "round",  "x": 200, "y": 80,  "status": "seated",   "timer": "45m", "vip": False, "rotation": 0},
    {"id": "t2", "type": "table", "name": "T-02", "seats": 4, "zone": "main", "shape": "square", "x": 440, "y": 80,  "status": "reserved", "nextTime": "6:30 PM", "guest": "Smith (4)", "rotation": 0},
    {"id": "t3", "type": "table", "name": "T-03", "seats": 2, "zone": "main", "shape": "square", "x": 680, "y": 80,  "status": "available", "rotation": 0},
    {"id": "t4", "type": "table", "name": "T-04", "seats": 6, "zone": "main", "shape": "round",  "x": 200, "y": 320, "status": "seated",   "timer": "12m", "vip": True, "rotation": 0},
    {"id": "t5", "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "round",  "x": 440, "y": 320, "status": "dirty", "rotation": 0},
    {"id": "t6", "type": "table", "name": "T-06", "seats": 8, "zone": "main", "shape": "long",   "x": 600, "y": 320, "status": "mains", "guest": "Williams", "rotation": 0},
    # Main Floor — Fixtures
    {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 20,  "y": 20,  "rotation": 0},
    {"id": "f2", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 20,  "y": 200, "rotation": 0},
    {"id": "f3", "type": "fixture", "fixtureKind": "bar",     "name": "Bar",     "zone": "main", "x": 20,  "y": 400, "rotation": 0},
    {"id": "f4", "type": "fixture", "fixtureKind": "stairs",  "name": "Stairs",  "zone": "main", "x": 920, "y": 20,  "rotation": 0},
    {"id": "f5", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": 910, "y": 400, "rotation": 0},
    {"id": "f6", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": 840, "y": 200, "rotation": 0},
    # Terrace
    {"id": "t7", "type": "table", "name": "T-07", "seats": 4, "zone": "terrace", "shape": "round", "x": 60,  "y": 50, "status": "available", "rotation": 0},
    {"id": "t8", "type": "table", "name": "T-08", "seats": 6, "zone": "terrace", "shape": "long",  "x": 250, "y": 50, "status": "seated", "timer": "35m", "guest": "Park", "rotation": 0},
]

db = MongoClient("localhost:27017").rezvo

# Reset ALL businesses that have a floor_plan to the rich demo defaults
result = db.businesses.update_many(
    {"floor_plan": {"$exists": True}},
    {"$set": {
        "floor_plan": {
            "elements": DEFAULT_ELEMENTS,
            "width": 1000,
            "height": 800,
            "room_config": None,
        }
    }}
)
print(f"Reset {result.modified_count} business floor plans to rich demo defaults")

# Also reset any that DON'T have floor_plan yet
result2 = db.businesses.update_many(
    {"floor_plan": {"$exists": False}},
    {"$set": {
        "floor_plan": {
            "elements": DEFAULT_ELEMENTS,
            "width": 1000,
            "height": 800,
            "room_config": None,
        }
    }}
)
print(f"Added floor plans to {result2.modified_count} businesses without one")
print("Done — refresh portal.rezvo.app/dashboard/floor-plan to see coloured tables")
