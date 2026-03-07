"""
Seed Rejuvenate shop with real products from Natalie's Shopify store.
Products: Amatus Skincare + Dermalogica
Packages: Treatment courses
Vouchers: Gift vouchers

Run: cd /opt/rezvo-app && python3 backend/scripts/seed_shop.py
"""
import asyncio
import os
import sys
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

    # Clear existing shop data for Rejuvenate
    await db.shop_products.delete_many({"business_id": REJUVENATE_BIZ_ID})
    await db.shop_discounts.delete_many({"business_id": REJUVENATE_BIZ_ID})
    print("Cleared existing shop data")

    # ─── AMATUS SKINCARE (Own Brand) ───
    amatus_products = [
        {
            "name": "Amatus Gentle 3-Step Routine",
            "description": "Hydration and barrier repair for sensitive and dry skin types. Includes Gentle Cleanser, Gentle Toner, and Gentle Moisturiser.",
            "category": "Amatus Skincare",
            "subcategory": "Sets",
            "price": 189.00,
            "stock": 15,
            "tags": ["bestseller", "set", "gentle", "sensitive skin"],
        },
        {
            "name": "Amatus Complex 3-Step Routine",
            "description": "Targets acne, pigmentation, and aging with active acids and peptides. Includes Complex Cleanser, Complex Toner, and Complex Moisturiser.",
            "category": "Amatus Skincare",
            "subcategory": "Sets",
            "price": 188.95,
            "tags": ["set", "complex", "anti-aging", "acne"],
        },
        {
            "name": "Amatus Complex Daily Set",
            "description": "The Daily set includes the Complex Cleanser & Complex Moisturiser. The perfect skincare set to hydrate, clear, firm and brighten your skin.",
            "category": "Amatus Skincare",
            "subcategory": "Sets",
            "price": 129.95,
            "stock": 20,
            "tags": ["set", "daily"],
        },
        {
            "name": "Amatus Complex Cleanser",
            "description": "Deep-cleaning formula with active acids. Removes impurities while treating breakouts and pigmentation.",
            "category": "Amatus Skincare",
            "subcategory": "Cleansers",
            "price": 64.95,
            "stock": 25,
            "tags": ["cleanser", "complex"],
        },
        {
            "name": "Amatus Complex Moisturiser",
            "description": "Anti-wrinkle and brightening complex moisturiser. Firms, hydrates, and evens skin tone.",
            "category": "Amatus Skincare",
            "subcategory": "Moisturisers",
            "price": 64.95,
            "stock": 22,
            "tags": ["moisturiser", "anti-wrinkle", "brightening"],
        },
        {
            "name": "Amatus Gentle Cleanser",
            "description": "Soothing cleanser for sensitive skin. Removes makeup and impurities without stripping the barrier.",
            "category": "Amatus Skincare",
            "subcategory": "Cleansers",
            "price": 59.95,
            "stock": 18,
            "tags": ["cleanser", "gentle", "sensitive"],
        },
        {
            "name": "Amatus Gentle Moisturiser",
            "description": "Barrier-repair moisturiser for dry and sensitive skin. Locks in hydration without irritation.",
            "category": "Amatus Skincare",
            "subcategory": "Moisturisers",
            "price": 59.95,
            "stock": 20,
            "tags": ["moisturiser", "gentle", "barrier repair"],
        },
        {
            "name": "Amatus Peelieve Post-Treatment Cream",
            "description": "Aftercare recovery cream for post-treatment skin. Calms redness, supports healing, and protects the barrier.",
            "category": "Amatus Skincare",
            "subcategory": "Aftercare",
            "price": 45.00,
            "stock": 30,
            "tags": ["aftercare", "post-treatment", "recovery"],
        },
    ]

    # ─── DERMALOGICA PRODUCTS ───
    dermalogica_products = [
        {
            "name": "Dermalogica Daily Microfoliant",
            "description": "Resurfacing rice-based powder exfoliant that polishes skin. Brightens and smooths with daily use.",
            "category": "Dermalogica",
            "subcategory": "Exfoliants",
            "price": 49.50,
            "stock": 24,
            "tags": ["exfoliant", "bestseller", "daily"],
        },
        {
            "name": "Dermalogica Daily Superfoliant",
            "description": "Detoxifying charcoal-based powder exfoliant. Resurfaces while fighting pollution for smoother skin.",
            "category": "Dermalogica",
            "subcategory": "Exfoliants",
            "price": 58.00,
            "stock": 16,
            "tags": ["exfoliant", "charcoal", "anti-pollution"],
        },
        {
            "name": "Dermalogica BioLumin-C Serum",
            "description": "Ultra-bright vitamin C serum. Firms, brightens, and dramatically reduces hyperpigmentation.",
            "category": "Dermalogica",
            "subcategory": "Serums",
            "price": 82.00,
            "stock": 12,
            "tags": ["serum", "vitamin c", "brightening"],
        },
        {
            "name": "Dermalogica BioLumin-C Gel Moisturiser",
            "description": "Lightweight gel moisturiser with vitamin C. Brightens while providing all-day hydration.",
            "category": "Dermalogica",
            "subcategory": "Moisturisers",
            "price": 62.00,
            "stock": 14,
            "tags": ["moisturiser", "vitamin c", "gel"],
        },
        {
            "name": "Dermalogica Dynamic Skin Recovery SPF 50",
            "description": "Medium-weight SPF 50 moisturiser. Firms skin while providing broad-spectrum sun protection.",
            "category": "Dermalogica",
            "subcategory": "SPF",
            "price": 69.00,
            "stock": 20,
            "tags": ["spf", "spf50", "anti-aging"],
        },
        {
            "name": "Dermalogica AGE Bright Clearing Serum",
            "description": "Dual-action serum that clears breakouts while fighting signs of ageing. Salicylic acid + niacinamide.",
            "category": "Dermalogica",
            "subcategory": "Serums",
            "price": 62.00,
            "stock": 10,
            "tags": ["serum", "clearing", "anti-aging"],
        },
        {
            "name": "Dermalogica PreCleanse Balm",
            "description": "Melting pretreatment balm that dissolves layers of excess oil, sunscreen, waterproof makeup, and environmental pollutants.",
            "category": "Dermalogica",
            "subcategory": "Cleansers",
            "price": 38.00,
            "stock": 18,
            "tags": ["cleanser", "precleanse", "balm"],
        },
        {
            "name": "Dermalogica Skin Smoothing Cream",
            "description": "Medium-weight moisturiser with active HydraMesh technology. Provides 48 hours of continuous hydration.",
            "category": "Dermalogica",
            "subcategory": "Moisturisers",
            "price": 55.00,
            "stock": 14,
            "tags": ["moisturiser", "hydrating"],
        },
    ]

    # ─── SKIN KITS ───
    kits = [
        {
            "name": "Daily Brightness Boosters Skin Kit",
            "description": "The kit to give you the daily brightness boost. Contains Daily Glycolic Cleanser 30ml, BioLumin-C Serum 10ml, and BioLumin-C Gel Moisturiser 15ml.",
            "category": "Skin Kits",
            "price": 39.50,
            "stock": 10,
            "tags": ["kit", "travel size", "brightening"],
        },
        {
            "name": "Active Clearing Skin Kit",
            "description": "Highly active ingredients to clear breakouts, smooth skin and brighten skin tone. Contains Clearing Skin Wash 50ml, Daily Microfoliant 13g, and AGE Bright Clearing Serum 10ml.",
            "category": "Skin Kits",
            "price": 39.50,
            "stock": 8,
            "tags": ["kit", "clearing", "acne"],
        },
        {
            "name": "Skin Transformation Duo",
            "description": "Reinforces skin's natural barrier while enhancing radiance and visible firmness. Daily Microfoliant 40g + Dynamic Skin Recovery SPF 50 Travel 15ml.",
            "category": "Skin Kits",
            "price": 45.00,
            "stock": 12,
            "tags": ["kit", "duo", "transformation"],
        },
    ]

    # ─── TREATMENT PACKAGES (type: package) ───
    packages = [
        {
            "name": "18-Week Intensive Correction Plan",
            "description": "The complete skin transformation. 6 microneedling facials with LED light therapy, dermaplaning, targeted boosters, and a full-size Peelieve post-treatment cream. Plus 15% off Amatus homecare.",
            "category": "Treatment Packages",
            "price": 990.00,
            "type": "package",
            "shipping_required": False,
            "tags": ["package", "bestseller", "microneedling", "course"],
        },
        {
            "name": "Quick Fix Glow Up",
            "description": "When you need results fast. 45-minute express lymphatic facial for instant radiance — perfect pre-event or as regular maintenance.",
            "category": "Treatment Packages",
            "price": 115.00,
            "type": "package",
            "shipping_required": False,
            "tags": ["package", "express", "lymphatic"],
        },
        {
            "name": "Ultimate Skin Rejuvenation Ritual",
            "description": "The full experience. Microneedling with exosomes, LED therapy, lymphatic drainage, and advanced boosters in one extended session.",
            "category": "Treatment Packages",
            "price": 330.00,
            "type": "package",
            "shipping_required": False,
            "tags": ["package", "luxury", "ultimate"],
        },
        {
            "name": "Microneedling with Exosomes",
            "description": "Next-generation cellular regeneration. Exosome boosters delivered via microneedling amplify the repair response for exceptional anti-ageing and healing results.",
            "category": "Treatment Packages",
            "price": 315.00,
            "type": "package",
            "shipping_required": False,
            "tags": ["package", "exosomes", "advanced"],
        },
    ]

    # ─── GIFT VOUCHERS (type: voucher) ───
    voucher_products = [
        {
            "name": "Rejuvenate Gift Voucher — £50",
            "description": "Treat someone special to the gift of great skin. Redeemable on any treatment or product.",
            "category": "Gift Vouchers",
            "price": 50.00,
            "type": "voucher",
            "shipping_required": False,
            "track_stock": False,
            "tags": ["voucher", "gift"],
        },
        {
            "name": "Rejuvenate Gift Voucher — £100",
            "description": "The perfect gift for skin lovers. Redeemable on any treatment, package, or product.",
            "category": "Gift Vouchers",
            "price": 100.00,
            "type": "voucher",
            "shipping_required": False,
            "track_stock": False,
            "tags": ["voucher", "gift"],
        },
        {
            "name": "Rejuvenate Gift Voucher — £200",
            "description": "A luxury gift of skin transformation. Covers a full treatment package or product haul.",
            "category": "Gift Vouchers",
            "price": 200.00,
            "type": "voucher",
            "shipping_required": False,
            "track_stock": False,
            "tags": ["voucher", "gift", "luxury"],
        },
    ]

    # ─── INSERT ALL ───
    all_products = []
    sort_order = 0
    for products, source in [
        (amatus_products, "Amatus Skincare"),
        (dermalogica_products, "Dermalogica"),
        (kits, "Skin Kits"),
        (packages, "Treatment Packages"),
        (voucher_products, "Gift Vouchers"),
    ]:
        for p in products:
            sort_order += 1
            doc = {
                "business_id": REJUVENATE_BIZ_ID,
                "product_id": f"prod_{''.join(__import__('random').choices(__import__('string').ascii_lowercase + __import__('string').digits, k=10))}",
                "name": p["name"],
                "description": p.get("description", ""),
                "category": p.get("category", "general"),
                "subcategory": p.get("subcategory", ""),
                "price": p["price"],
                "compare_at_price": None,
                "cost_price": None,
                "sku": "",
                "barcode": "",
                "stock": p.get("stock", 0),
                "track_stock": p.get("track_stock", True),
                "low_stock_threshold": 5,
                "images": [],
                "variants": [],
                "tags": p.get("tags", []),
                "status": "active",
                "type": p.get("type", "physical"),
                "weight_g": None,
                "shipping_required": p.get("shipping_required", True),
                "visible_online": True,
                "sort_order": sort_order,
                "seo_title": "",
                "seo_description": "",
                "created_at": now,
                "updated_at": now,
                "deleted": False,
            }
            all_products.append(doc)

    await db.shop_products.insert_many(all_products)
    print(f"Inserted {len(all_products)} products:")
    for p in all_products:
        print(f"  {p['category']:25s} | {p['name']:50s} | £{p['price']}")

    # ─── DISCOUNT CODES ───
    discounts = [
        {"code": "WELCOME15", "type": "percentage", "value": 15, "max_uses": 100, "applies_to": "all", "status": "active"},
        {"code": "SKIN10", "type": "fixed", "value": 10, "min_spend": 50, "max_uses": 50, "applies_to": "all", "status": "active"},
        {"code": "AMATUS20", "type": "percentage", "value": 20, "applies_to": "category", "category": "Amatus Skincare", "max_uses": 30, "status": "active"},
    ]
    for d in discounts:
        d["business_id"] = REJUVENATE_BIZ_ID
        d["used"] = 0
        d["created_at"] = now
        d.setdefault("min_spend", None)
        d.setdefault("expires_at", None)
        d.setdefault("product_ids", [])
        d.setdefault("category", None)
    await db.shop_discounts.insert_many(discounts)
    print(f"\nInserted {len(discounts)} discount codes: {', '.join(d['code'] for d in discounts)}")

    # Create indexes
    await db.shop_products.create_index([("business_id", 1), ("status", 1)])
    await db.shop_products.create_index([("business_id", 1), ("category", 1)])
    await db.shop_orders.create_index([("business_id", 1), ("created_at", -1)])
    await db.shop_carts.create_index([("cart_id", 1), ("business_id", 1)])
    await db.shop_discounts.create_index([("business_id", 1), ("code", 1)])
    await db.shop_vouchers.create_index([("business_id", 1), ("code", 1)])
    print("\nIndexes created. Shop ready!")


asyncio.run(main())
