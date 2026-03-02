"""
Enable ReeveOS EPOS for Micho Restaurant
==========================================
Adds all EPOS configuration to Micho's business document:
- KDS station routing
- Loyalty programme config
- Cash management defaults
- Labour/staff settings
- Pay-at-table QR tokens
- Default service charge
- Order numbering
- Inventory categories

Run on VPS: cd /opt/rezvo-app && python backend/scripts/enable_epos_micho.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import secrets

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")


async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # ─── Find Micho ─── #
    micho = await db.businesses.find_one({"name": {"$regex": "micho", "$options": "i"}})
    
    if not micho:
        # Try broader search
        micho = await db.businesses.find_one({"$or": [
            {"name": {"$regex": "micho", "$options": "i"}},
            {"slug": {"$regex": "micho", "$options": "i"}},
            {"owner_name": {"$regex": "sadkine", "$options": "i"}},
            {"owner_name": {"$regex": "krizilkaya", "$options": "i"}},
        ]})

    if not micho:
        print("❌ Micho not found in database. Listing all businesses:")
        async for biz in db.businesses.find({}, {"name": 1, "slug": 1, "owner_name": 1}):
            print(f"  - {biz.get('name', 'unnamed')} (ID: {biz['_id']})")
        print("\n⚠️  Update the BUSINESS_ID below and re-run")
        client.close()
        return

    biz_id = str(micho["_id"])
    print(f"✅ Found Micho: {micho.get('name')} (ID: {biz_id})")
    print(f"   Owner: {micho.get('owner_name', 'N/A')}")
    print(f"   Current features: {list(micho.get('features', {}).keys()) if micho.get('features') else 'None'}")
    print()

    now = datetime.utcnow()

    # ═══════════════════════════════════════════════════════
    # 1. KDS STATION CONFIGURATION
    # ═══════════════════════════════════════════════════════
    kds_config = {
        "stations": [
            {
                "id": "main_kitchen",
                "name": "Main Kitchen",
                "type": "prep",
                "categories": ["mains", "starters", "sides", "kebabs", "grills", "mezze"],
                "color": "#ef4444",
                "active": True,
            },
            {
                "id": "bar",
                "name": "Bar / Drinks",
                "type": "bar",
                "categories": ["drinks", "beverages", "cocktails", "desserts"],
                "color": "#3b82f6",
                "active": True,
            },
            {
                "id": "expo",
                "name": "Expo / Pass",
                "type": "expo",
                "categories": [],  # sees all tickets
                "color": "#22c55e",
                "active": True,
            },
        ],
        "target_prep_time_minutes": 12,
        "auto_bump_after_minutes": 30,
        "sound_enabled": True,
        "show_allergens": True,
        "show_modifiers": True,
        "show_seat_numbers": True,
    }
    print("✅ KDS stations configured (Main Kitchen, Bar, Expo)")

    # ═══════════════════════════════════════════════════════
    # 2. LOYALTY PROGRAMME CONFIG
    # ═══════════════════════════════════════════════════════
    loyalty_config = {
        "enabled": True,
        "programme_name": "Micho Rewards",
        "points_per_pound": 1,        # 1 point per £1 spent
        "redemption_rate": 100,         # 100 points = £1 off
        "welcome_bonus": 50,            # 50 points on signup
        "birthday_bonus": 200,          # 200 points on birthday
        "referral_bonus": 100,          # 100 points for referral
        "tiers": [
            {"name": "Bronze", "min_points": 0, "multiplier": 1.0},
            {"name": "Silver", "min_points": 500, "multiplier": 1.25},
            {"name": "Gold", "min_points": 1500, "multiplier": 1.5},
            {"name": "Platinum", "min_points": 5000, "multiplier": 2.0},
        ],
        "created_at": now,
    }
    print("✅ Loyalty programme configured (Micho Rewards)")

    # ═══════════════════════════════════════════════════════
    # 3. EPOS ORDER SETTINGS
    # ═══════════════════════════════════════════════════════
    epos_settings = {
        "epos_enabled": True,
        "default_service_charge": 0,      # 0% default, can set per order
        "vat_rate": 20,                    # UK standard
        "vat_registered": True,
        "currency": "GBP",
        "order_types_enabled": ["dine_in", "takeaway", "delivery", "kiosk"],
        "auto_print_receipt": True,
        "auto_print_kitchen": True,
        "require_table_for_dine_in": True,
        "allow_open_items": True,          # custom price items
        "default_tip_options": [10, 12.5, 15, 20],  # percentage options
        "receipt_footer": "Thank you for dining at Micho! 🇹🇷",
        "receipt_show_vat": True,
    }
    print("✅ EPOS order settings configured")

    # ═══════════════════════════════════════════════════════
    # 4. STAFF MEMBERS (from memory: Sadkine, Serhat, Yaren)
    # ═══════════════════════════════════════════════════════
    staff_members = micho.get("staff", [])
    
    # Only add if not already populated
    if not staff_members or len(staff_members) < 3:
        staff_members = [
            {
                "id": "staff_001",
                "name": "Sadkine Krizilkaya",
                "role": "owner",
                "pin": "1001",
                "hourly_rate": 0,  # owner
                "permissions": ["all"],
                "active": True,
                "created_at": now,
            },
            {
                "id": "staff_002",
                "name": "Serhat",
                "role": "floor_manager",
                "pin": "1002",
                "hourly_rate": 14.50,
                "permissions": ["orders", "kds", "discounts", "voids", "reports", "cash"],
                "active": True,
                "created_at": now,
            },
            {
                "id": "staff_003",
                "name": "Yaren Krizilkaya",
                "role": "waitress",
                "pin": "1003",
                "hourly_rate": 11.44,  # UK NLW 2025
                "permissions": ["orders", "kds"],
                "active": True,
                "created_at": now,
            },
        ]
        print("✅ Staff configured (Sadkine, Serhat, Yaren)")
    else:
        print(f"⏭️  Staff already configured ({len(staff_members)} members)")

    # ═══════════════════════════════════════════════════════
    # 5. PAY-AT-TABLE QR TOKENS
    # ═══════════════════════════════════════════════════════
    # Generate tokens for existing tables in floor plan
    floor_plan = micho.get("floor_plan", {})
    tables = floor_plan.get("tables", [])
    
    table_tokens = []
    if tables:
        for table in tables:
            token = secrets.token_urlsafe(16)
            table_tokens.append({
                "table_id": table.get("id"),
                "table_number": table.get("label", table.get("number", table.get("id"))),
                "token": token,
                "qr_url": f"https://reeve.now/t/{token}",
                "created_at": now,
            })
        print(f"✅ QR tokens generated for {len(table_tokens)} tables")
    else:
        # Create some default tables if none exist
        for i in range(1, 13):  # 12 tables
            tid = f"table_{i}"
            token = secrets.token_urlsafe(16)
            tables.append({
                "id": tid,
                "number": i,
                "label": f"Table {i}",
                "seats": 4 if i <= 8 else 6,
                "status": "available",
                "current_order_id": None,
                "x": 50 + ((i - 1) % 4) * 150,
                "y": 50 + ((i - 1) // 4) * 150,
                "shape": "round" if i <= 8 else "rectangle",
            })
            table_tokens.append({
                "table_id": tid,
                "table_number": f"Table {i}",
                "token": token,
                "qr_url": f"https://reeve.now/t/{token}",
                "created_at": now,
            })
        floor_plan["tables"] = tables
        print(f"✅ Created 12 default tables + QR tokens")

    # ═══════════════════════════════════════════════════════
    # 6. CASH MANAGEMENT DEFAULTS
    # ═══════════════════════════════════════════════════════
    cash_config = {
        "default_float": 200.00,       # £200 opening float
        "require_close_count": True,    # must count at end of day
        "auto_close_time": "23:30",     # reminder to close
        "denomination_tracking": True,
    }
    print("✅ Cash management defaults set (£200 float)")

    # ═══════════════════════════════════════════════════════
    # 7. INVENTORY CATEGORIES (Turkish restaurant)
    # ═══════════════════════════════════════════════════════
    inventory_categories = [
        "meat", "poultry", "seafood", "dairy", "vegetables", "salad",
        "bread", "rice_grains", "spices", "oils_sauces", "drinks",
        "alcohol", "dessert_ingredients", "dry_goods", "packaging", "cleaning"
    ]
    print("✅ Inventory categories configured for Turkish cuisine")

    # ═══════════════════════════════════════════════════════
    # 8. FEATURES FLAG
    # ═══════════════════════════════════════════════════════
    features = micho.get("features", {})
    features.update({
        "epos": True,
        "kds": True,
        "inventory": True,
        "labour": True,
        "loyalty": True,
        "pay_at_table": True,
        "online_ordering": True,
        "kiosk": True,
        "cash_management": True,
        "tax_reporting": True,
        "ai_menu_optimizer": True,
        "ai_prep_forecast": True,
        "ai_upsell": True,
        "ai_waste_predictor": True,
        "multi_site": True,
        "digital_receipts": True,
    })
    print("✅ All EPOS feature flags enabled")

    # ═══════════════════════════════════════════════════════
    # APPLY ALL UPDATES
    # ═══════════════════════════════════════════════════════
    update = {
        "$set": {
            "kds_config": kds_config,
            "loyalty_config": loyalty_config,
            "epos_settings": epos_settings,
            "staff": staff_members,
            "table_tokens": table_tokens,
            "cash_config": cash_config,
            "inventory_categories": inventory_categories,
            "features": features,
            "floor_plan": floor_plan,
            "epos_enabled_at": now,
            "updated_at": now,
        }
    }

    result = await db.businesses.update_one({"_id": micho["_id"]}, update)

    if result.modified_count > 0:
        print(f"\n{'='*55}")
        print(f"  ✅ EPOS FULLY ENABLED FOR MICHO")
        print(f"{'='*55}")
        print(f"  Business ID: {biz_id}")
        print(f"  Features enabled: {len(features)}")
        print(f"  KDS stations: {len(kds_config['stations'])}")
        print(f"  Staff members: {len(staff_members)}")
        print(f"  Tables with QR: {len(table_tokens)}")
        print(f"  Loyalty: {loyalty_config['programme_name']}")
        print()
        print("  Micho can now use:")
        print("  • Full order management (dine-in/takeaway/delivery/kiosk)")
        print("  • Kitchen Display System (3 stations)")
        print("  • Inventory & stock tracking")
        print("  • Staff clock in/out & labour tracking")
        print("  • Pay-at-table QR ordering")
        print("  • Loyalty programme (Micho Rewards)")
        print("  • Cash drawer management")
        print("  • VAT/HMRC reporting")
        print("  • AI menu optimizer + prep forecast + upsell + waste predictor")
        print("  • Online ordering")
        print()
        print("  ⚠️  Frontend screens needed before staff can use the till")
    else:
        print("\n⚠️  No changes made — document may already be up to date")

    # ═══════════════════════════════════════════════════════
    # ALSO: Seed some sample inventory for demo
    # ═══════════════════════════════════════════════════════
    ingredient_count = await db.ingredients.count_documents({"business_id": biz_id})
    
    if ingredient_count == 0:
        sample_ingredients = [
            {"name": "Lamb Mince", "category": "meat", "unit": "kg", "current_stock": 15, "min_stock": 5, "max_stock": 30, "cost_per_unit": 8.50, "shelf_life_days": 3, "allergens": []},
            {"name": "Chicken Breast", "category": "poultry", "unit": "kg", "current_stock": 20, "min_stock": 8, "max_stock": 40, "cost_per_unit": 5.20, "shelf_life_days": 3, "allergens": []},
            {"name": "Minced Beef", "category": "meat", "unit": "kg", "current_stock": 12, "min_stock": 5, "max_stock": 25, "cost_per_unit": 7.80, "shelf_life_days": 3, "allergens": []},
            {"name": "Flatbread (Pide)", "category": "bread", "unit": "units", "current_stock": 50, "min_stock": 20, "max_stock": 100, "cost_per_unit": 0.35, "shelf_life_days": 2, "allergens": ["gluten"]},
            {"name": "Halloumi", "category": "dairy", "unit": "kg", "current_stock": 5, "min_stock": 2, "max_stock": 10, "cost_per_unit": 9.00, "shelf_life_days": 14, "allergens": ["dairy"]},
            {"name": "Feta Cheese", "category": "dairy", "unit": "kg", "current_stock": 4, "min_stock": 2, "max_stock": 8, "cost_per_unit": 7.50, "shelf_life_days": 14, "allergens": ["dairy"]},
            {"name": "Yoghurt (Turkish)", "category": "dairy", "unit": "l", "current_stock": 8, "min_stock": 3, "max_stock": 15, "cost_per_unit": 2.80, "shelf_life_days": 10, "allergens": ["dairy"]},
            {"name": "Sumac", "category": "spices", "unit": "kg", "current_stock": 2, "min_stock": 0.5, "max_stock": 5, "cost_per_unit": 12.00, "shelf_life_days": 365, "allergens": []},
            {"name": "Cumin (Ground)", "category": "spices", "unit": "kg", "current_stock": 1.5, "min_stock": 0.5, "max_stock": 3, "cost_per_unit": 8.00, "shelf_life_days": 365, "allergens": []},
            {"name": "Chilli Flakes (Pul Biber)", "category": "spices", "unit": "kg", "current_stock": 1, "min_stock": 0.3, "max_stock": 3, "cost_per_unit": 15.00, "shelf_life_days": 365, "allergens": []},
            {"name": "Olive Oil", "category": "oils_sauces", "unit": "l", "current_stock": 10, "min_stock": 3, "max_stock": 20, "cost_per_unit": 6.50, "shelf_life_days": 365, "allergens": []},
            {"name": "Pomegranate Molasses", "category": "oils_sauces", "unit": "l", "current_stock": 3, "min_stock": 1, "max_stock": 6, "cost_per_unit": 8.00, "shelf_life_days": 180, "allergens": []},
            {"name": "Tomatoes", "category": "vegetables", "unit": "kg", "current_stock": 10, "min_stock": 5, "max_stock": 20, "cost_per_unit": 1.80, "shelf_life_days": 5, "allergens": []},
            {"name": "Onions", "category": "vegetables", "unit": "kg", "current_stock": 15, "min_stock": 5, "max_stock": 25, "cost_per_unit": 0.90, "shelf_life_days": 14, "allergens": []},
            {"name": "Peppers (Mixed)", "category": "vegetables", "unit": "kg", "current_stock": 6, "min_stock": 3, "max_stock": 12, "cost_per_unit": 2.50, "shelf_life_days": 5, "allergens": []},
            {"name": "Aubergine", "category": "vegetables", "unit": "kg", "current_stock": 5, "min_stock": 2, "max_stock": 10, "cost_per_unit": 2.20, "shelf_life_days": 5, "allergens": []},
            {"name": "Iceberg Lettuce", "category": "salad", "unit": "units", "current_stock": 8, "min_stock": 4, "max_stock": 15, "cost_per_unit": 0.65, "shelf_life_days": 4, "allergens": []},
            {"name": "Basmati Rice", "category": "rice_grains", "unit": "kg", "current_stock": 25, "min_stock": 10, "max_stock": 50, "cost_per_unit": 1.80, "shelf_life_days": 365, "allergens": []},
            {"name": "Bulgur Wheat", "category": "rice_grains", "unit": "kg", "current_stock": 10, "min_stock": 3, "max_stock": 20, "cost_per_unit": 2.20, "shelf_life_days": 365, "allergens": ["gluten"]},
            {"name": "Coca-Cola (330ml)", "category": "drinks", "unit": "units", "current_stock": 48, "min_stock": 24, "max_stock": 96, "cost_per_unit": 0.55, "shelf_life_days": 365, "allergens": []},
            {"name": "Ayran", "category": "drinks", "unit": "units", "current_stock": 24, "min_stock": 12, "max_stock": 48, "cost_per_unit": 0.80, "shelf_life_days": 14, "allergens": ["dairy"]},
            {"name": "Turkish Tea (Cay)", "category": "drinks", "unit": "kg", "current_stock": 3, "min_stock": 1, "max_stock": 5, "cost_per_unit": 12.00, "shelf_life_days": 365, "allergens": []},
            {"name": "Pistachio (Shelled)", "category": "dessert_ingredients", "unit": "kg", "current_stock": 2, "min_stock": 0.5, "max_stock": 5, "cost_per_unit": 28.00, "shelf_life_days": 90, "allergens": ["nuts"]},
            {"name": "Takeaway Containers (Large)", "category": "packaging", "unit": "units", "current_stock": 200, "min_stock": 50, "max_stock": 500, "cost_per_unit": 0.12, "shelf_life_days": 999, "allergens": []},
        ]

        for ing in sample_ingredients:
            ing["business_id"] = biz_id
            ing["storage_location"] = ""
            ing["supplier_id"] = None
            ing["supplier_sku"] = ""
            ing["created_at"] = now
            ing["updated_at"] = now

        await db.ingredients.insert_many(sample_ingredients)
        print(f"\n✅ Seeded {len(sample_ingredients)} Turkish cuisine ingredients for demo")
    else:
        print(f"\n⏭️  Inventory already has {ingredient_count} ingredients")

    # ═══════════════════════════════════════════════════════
    # Create indexes for performance
    # ═══════════════════════════════════════════════════════
    await db.orders.create_index([("business_id", 1), ("status", 1)])
    await db.orders.create_index([("business_id", 1), ("created_at", -1)])
    await db.kds_tickets.create_index([("business_id", 1), ("status", 1)])
    await db.ingredients.create_index([("business_id", 1), ("category", 1)])
    await db.time_clock.create_index([("business_id", 1), ("clock_out", 1)])
    await db.waste_log.create_index([("business_id", 1), ("created_at", -1)])
    await db.stock_adjustments.create_index([("business_id", 1), ("created_at", -1)])
    print("✅ Database indexes created for EPOS performance")

    client.close()
    print("\n🎉 Done! Micho is EPOS-ready.")


if __name__ == "__main__":
    asyncio.run(run())
