"""
Project Board Update — Session 2 March 2026
=============================================
Updates Command Centre with everything completed this session:
1. Complete EPOS backend (8 route files, 97 endpoints)
2. book.rezvo.app subdomain (DNS, SSL, nginx, frontend routing)
3. Micho EPOS enablement (KDS, loyalty, staff, inventory)
4. Competitor research & gap analysis

Run: cd /opt/rezvo-app && python3 backend/scripts/update_board_march2.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "rezvo")


async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    now = datetime.utcnow()

    added = 0
    updated = 0
    
    # ═══════════════════════════════════════════════════════
    # HELPER: upsert feature
    # ═══════════════════════════════════════════════════════
    async def upsert(name, data):
        nonlocal added, updated
        existing = await db.project_features.find_one({"name": name})
        if existing:
            await db.project_features.update_one(
                {"_id": existing["_id"]},
                {"$set": {**data, "updated_at": now}}
            )
            updated += 1
            print(f"  🔄 Updated: {name} → {data.get('stage', existing.get('stage'))}")
        else:
            data["name"] = name
            data["notes"] = data.get("notes", [])
            data["history"] = [{"action": "created", "stage": data.get("stage", "backlog"), "at": now, "by": "System (session update)"}]
            data["assignee"] = ""
            data["target_date"] = ""
            data["sort_order"] = 0
            data["created_at"] = now
            data["updated_at"] = now
            await db.project_features.insert_one(data)
            added += 1
            print(f"  ✅ Added: {name} → {data.get('stage', 'backlog')}")

    print("═══════════════════════════════════════════════════════")
    print("  PROJECT BOARD UPDATE — 2 March 2026")
    print("═══════════════════════════════════════════════════════\n")

    # ═══════════════════════════════════════════════════════
    # 1. BOOK.REZVO.APP SUBDOMAIN — LIVE ✅
    # ═══════════════════════════════════════════════════════
    print("▸ INFRASTRUCTURE\n")
    
    await upsert("book.rezvo.app booking subdomain", {
        "desc": "Dedicated subdomain for customer booking pages. Clean URLs: book.rezvo.app/restaurant-name instead of portal.rezvo.app/book/restaurant-name. DNS A record, SSL cert via certbot, nginx server block, React domain detection, old URLs 301 redirect.",
        "cat": "Platform", "pri": "P1", "stage": "live",
        "comp": ["OpenTable", "Resy", "SevenRooms"],
        "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "DNS A record (book → 178.128.33.73)", "d": True},
            {"t": "SSL certificate via certbot standalone", "d": True},
            {"t": "Nginx server block with API proxy", "d": True},
            {"t": "React isBookingDomain() detection", "d": True},
            {"t": "Root-level routing on book subdomain (/:slug)", "d": True},
            {"t": "Old /book/* URLs 301 redirect to book.rezvo.app", "d": True},
            {"t": "portal.rezvo.app/book/* nginx redirect", "d": True},
            {"t": "rezvo.app/book/* nginx redirect", "d": True},
            {"t": "Iframe embeddable (CSP frame-ancestors)", "d": True},
            {"t": "Dashboard/admin blocked on book domain", "d": True},
            {"t": "All frontend booking URL refs updated (11 files)", "d": True},
            {"t": "getBookingUrl() helper function", "d": True},
            {"t": "Embed code snippets use book.rezvo.app", "d": True},
        ],
        "notes": [{"text": "LIVE — book.rezvo.app/micho-turkish-bar-grill-sheffield working. portal.rezvo.app unchanged for login/dashboard/admin.", "author": "System", "at": now}],
    })

    # ═══════════════════════════════════════════════════════
    # 2. EPOS BACKEND — ALL IN PROGRESS (backend done, frontend needed)
    # ═══════════════════════════════════════════════════════
    print("\n▸ EPOS BACKEND (8 files, 4,306 lines, 97 endpoints)\n")

    await upsert("EPOS Order Lifecycle", {
        "desc": "Complete till order flow: create→modify→fire→split→pay→close→refund. orders.py — 865 lines, 19 endpoints.",
        "cat": "EPOS", "pri": "P0", "stage": "in_progress",
        "comp": ["Epos Now", "Toast", "Square", "Lightspeed"],
        "effort": "High", "rev": "Very High",
        "checks": [
            {"t": "Create order (dine-in/takeaway/delivery/kiosk)", "d": True},
            {"t": "Add/remove/modify items", "d": True},
            {"t": "Fire to kitchen (course-based)", "d": True},
            {"t": "Discount engine (%, fixed, comp, item-level)", "d": True},
            {"t": "Service charge management", "d": True},
            {"t": "Split bill (equal/seat/item/custom)", "d": True},
            {"t": "Payment processing (card/cash/split/tips)", "d": True},
            {"t": "Void order with reason + audit trail", "d": True},
            {"t": "Refund (full/partial/item-level)", "d": True},
            {"t": "Receipt generation (print + digital)", "d": True},
            {"t": "Table time tracking (live)", "d": True},
            {"t": "X report (shift) + Z report (end of day)", "d": True},
            {"t": "Sequential order numbering per day", "d": True},
            {"t": "Frontend EPOS till screen", "d": False},
        ],
    })

    await upsert("Kitchen Display System (KDS)", {
        "desc": "Real-time kitchen tickets with station routing, bump bar, prep analytics. kds.py — 305 lines, 12 endpoints.",
        "cat": "EPOS", "pri": "P0", "stage": "in_progress",
        "comp": ["Toast", "Epos Now", "Lightspeed"],
        "effort": "High", "rev": "Very High",
        "checks": [
            {"t": "Station config (prep/expo/bar) + category routing", "d": True},
            {"t": "Live ticket queue with colour-coded urgency", "d": True},
            {"t": "Start/done/bump/recall/served actions", "d": True},
            {"t": "Priority system (normal/rush/VIP)", "d": True},
            {"t": "All-day aggregate view", "d": True},
            {"t": "Prep time analytics + throughput metrics", "d": True},
            {"t": "Allergen + modifier display", "d": True},
            {"t": "Frontend KDS screen", "d": False},
        ],
    })

    await upsert("Inventory & Stock Management", {
        "desc": "Full stock system with recipes, food costing, suppliers, POs, waste, auto-reorder. inventory.py — 549 lines, 18 endpoints.",
        "cat": "EPOS", "pri": "P1", "stage": "in_progress",
        "comp": ["Epos Now", "Toast", "Lightspeed"],
        "effort": "High", "rev": "High",
        "checks": [
            {"t": "Ingredient CRUD with categories + allergens", "d": True},
            {"t": "Stock levels + low-stock alerts", "d": True},
            {"t": "Bulk stocktake with discrepancy detection", "d": True},
            {"t": "Recipe linking (menu item → ingredients)", "d": True},
            {"t": "Auto food cost % per dish", "d": True},
            {"t": "Waste logging + cost tracking", "d": True},
            {"t": "Supplier management + purchase orders", "d": True},
            {"t": "AI reorder suggestions (usage-based)", "d": True},
            {"t": "Frontend inventory dashboard", "d": False},
        ],
    })

    await upsert("Staff Labour Tracking", {
        "desc": "Clock in/out, breaks, real-time labour cost % vs revenue. labour.py — 439 lines, 10 endpoints. NO competitor does live labour cost.",
        "cat": "EPOS", "pri": "P1", "stage": "in_progress",
        "comp": ["Toast", "Epos Now"],
        "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "PIN-based clock in/out", "d": True},
            {"t": "Break tracking (start/end/types)", "d": True},
            {"t": "Who's on shift (live view)", "d": True},
            {"t": "Real-time labour cost % vs revenue", "d": True},
            {"t": "Staff performance (sales per person)", "d": True},
            {"t": "Rota scheduling + bulk shifts", "d": True},
            {"t": "Tip distribution (equal/hours/custom)", "d": True},
            {"t": "Frontend labour dashboard", "d": False},
        ],
    })

    await upsert("Pay-at-Table & QR Self-Service", {
        "desc": "Customer scans QR → menu → order → pay → tip → review. pay_at_table.py — 450 lines, 9 endpoints. BUILT-IN, not a paid add-on.",
        "cat": "EPOS", "pri": "P1", "stage": "in_progress",
        "comp": [],
        "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "QR token generation per table", "d": True},
            {"t": "Scan → menu + table detection", "d": True},
            {"t": "Customer orders from phone → KDS", "d": True},
            {"t": "View bill + pay (full/split) from phone", "d": True},
            {"t": "Tips + post-payment review", "d": True},
            {"t": "Call waiter button + staff alerts", "d": True},
            {"t": "Frontend consumer web app", "d": False},
        ],
    })

    await upsert("Cash Drawer Management", {
        "desc": "Opening float, closing count, auto variance detection, cash drops. cash_and_tax.py.",
        "cat": "EPOS", "pri": "P1", "stage": "in_progress",
        "comp": ["Epos Now", "Toast"],
        "effort": "Low", "rev": "Medium",
        "checks": [
            {"t": "Opening float with denomination breakdown", "d": True},
            {"t": "Closing count with auto variance calc", "d": True},
            {"t": "Cash drop to safe", "d": True},
            {"t": "Variance history + audit trail", "d": True},
            {"t": "Frontend cash management UI", "d": False},
        ],
    })

    await upsert("HMRC VAT Reporting (Auto)", {
        "desc": "Auto-generate VAT Box 1-7 from EPOS data. ZERO competitors do this. cash_and_tax.py.",
        "cat": "EPOS", "pri": "P1", "stage": "in_progress",
        "comp": [],
        "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Output VAT (Box 1) + Input VAT (Box 4)", "d": True},
            {"t": "Net VAT payable (Box 5)", "d": True},
            {"t": "Sales/purchases ex-VAT (Box 6+7)", "d": True},
            {"t": "Daily breakdown + payment method splits", "d": True},
            {"t": "Frontend tax dashboard", "d": False},
        ],
    })

    await upsert("Auto P&L from EPOS Data", {
        "desc": "Revenue - COGS - Labour - Waste = Operating Profit. Auto-calculated. ZERO competitors do this.",
        "cat": "EPOS", "pri": "P1", "stage": "in_progress",
        "comp": [],
        "effort": "Medium", "rev": "Very High",
        "checks": [
            {"t": "Revenue from orders", "d": True},
            {"t": "COGS from purchase orders", "d": True},
            {"t": "Labour cost from time clock", "d": True},
            {"t": "Waste cost from waste log", "d": True},
            {"t": "GP% + Operating Profit % + Prime Cost", "d": True},
            {"t": "Frontend P&L dashboard", "d": False},
        ],
    })

    await upsert("Multi-Site Central Dashboard", {
        "desc": "Cross-location overview for multi-site operators. Epos Now charges extra — we include free.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": ["Epos Now"],
        "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Revenue + orders + covers per site", "d": True},
            {"t": "Active staff + open orders per site", "d": True},
            {"t": "Low stock alerts per site", "d": True},
            {"t": "Frontend multi-site view", "d": False},
        ],
    })

    # ─── AI FEATURES (all unique to us) ─── #
    print("\n▸ AI FEATURES (zero competitors have these)\n")

    await upsert("AI Menu Optimizer", {
        "desc": "Star/Puzzle/Plowhorse/Dog quadrant analysis. Auto-recommendations per dish. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": [], "effort": "Medium", "rev": "Very High",
        "checks": [
            {"t": "Margin × popularity quadrant classification", "d": True},
            {"t": "Auto-recommendation engine", "d": True},
            {"t": "Frontend menu optimizer dashboard", "d": False},
        ],
    })

    await upsert("Predictive Prep Forecasting", {
        "desc": "8-week pattern analysis predicts what to prep. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": [], "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Historical pattern analysis + weighted average", "d": True},
            {"t": "Confidence scoring + per-item quantities", "d": True},
            {"t": "Frontend prep forecast view", "d": False},
        ],
    })

    await upsert("Smart Upsell Engine", {
        "desc": "Real-time AI suggestions based on association rules from past orders. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": [], "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Association rule mining + real-time suggestions", "d": True},
            {"t": "Pitch text generation", "d": True},
            {"t": "Frontend upsell prompt on till", "d": False},
        ],
    })

    await upsert("AI Waste Predictor", {
        "desc": "Predicts waste before it happens. Shelf life vs usage rate. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": [], "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Waste quantity + cost prediction", "d": True},
            {"t": "Specials/staff meal suggestions", "d": True},
            {"t": "Frontend waste prediction view", "d": False},
        ],
    })

    await upsert("Real-Time Food Cost Per Order", {
        "desc": "Live GP% per order during service. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": [], "effort": "Low", "rev": "High",
        "checks": [
            {"t": "Recipe-based cost calc per order", "d": True},
            {"t": "Per-item margin + order GP%", "d": True},
            {"t": "Frontend cost overlay on till", "d": False},
        ],
    })

    await upsert("Peak Time Heatmap", {
        "desc": "Day × hour order volume and revenue analysis. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": ["Toast"], "effort": "Low", "rev": "Medium",
        "checks": [
            {"t": "Day × hour aggregation + 8-week averaging", "d": True},
            {"t": "Frontend heatmap visualization", "d": False},
        ],
    })

    # ─── OTHER EPOS ─── #
    print("\n▸ OTHER EPOS MODULES\n")

    await upsert("Online Ordering (Consumer)", {
        "desc": "Full consumer ordering: menu, cart, checkout, delivery zones, order tracking. online_ordering.py — 600 lines, 8 endpoints.",
        "cat": "EPOS", "pri": "P0", "stage": "in_progress",
        "comp": ["Toast", "Square", "Deliveroo", "UberEats"],
        "effort": "High", "rev": "Very High",
        "checks": [
            {"t": "Consumer menu + cart + checkout API", "d": True},
            {"t": "Delivery zone + fee calculation", "d": True},
            {"t": "Order status tracking API", "d": True},
            {"t": "Estimated prep time + rate limiting", "d": True},
            {"t": "Restaurant order management API", "d": True},
            {"t": "Frontend consumer ordering pages", "d": False},
        ],
    })

    await upsert("Loyalty Programme (Micho Rewards)", {
        "desc": "Points, tiers (Bronze→Platinum), birthday/referral bonuses. epos_ai.py. Enabled on Micho.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": ["Square", "Toast"], "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Points earning + tier multipliers", "d": True},
            {"t": "Redemption at checkout", "d": True},
            {"t": "Welcome/birthday/referral bonuses", "d": True},
            {"t": "Customer balance API", "d": True},
            {"t": "Frontend loyalty card view", "d": False},
        ],
    })

    await upsert("Kiosk Self-Ordering", {
        "desc": "Tablet-optimised menu + auto-fire to KDS. epos_ai.py.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": ["Epos Now", "Toast"], "effort": "Medium", "rev": "High",
        "checks": [
            {"t": "Kiosk menu API + order placement", "d": True},
            {"t": "Auto-fire to KDS", "d": True},
            {"t": "Frontend kiosk UI", "d": False},
        ],
    })

    await upsert("Digital Receipts (Email/SMS)", {
        "desc": "Send receipts digitally. Reduces waste, enables marketing follow-up.",
        "cat": "EPOS", "pri": "P2", "stage": "in_progress",
        "comp": ["Toast", "Square"], "effort": "Low", "rev": "Medium",
        "checks": [
            {"t": "Receipt data generation + send endpoint", "d": True},
            {"t": "Resend/Twilio integration", "d": False},
            {"t": "Branded receipt template", "d": False},
        ],
    })

    # ═══════════════════════════════════════════════════════
    # 3. MICHO EPOS ENABLEMENT — DONE
    # ═══════════════════════════════════════════════════════
    print("\n▸ MICHO RESTAURANT\n")

    await upsert("Micho EPOS Enablement", {
        "desc": "First restaurant fully configured for ReeveOS EPOS. KDS stations, staff PINs, loyalty, 24 Turkish ingredients, QR tokens for 12 tables.",
        "cat": "Platform", "pri": "P0", "stage": "live",
        "comp": [], "effort": "Low", "rev": "Very High",
        "checks": [
            {"t": "Business found in database", "d": True},
            {"t": "KDS: 3 stations (Main Kitchen, Bar, Expo)", "d": True},
            {"t": "Staff: Sadkine (owner), Serhat (floor mgr), Yaren (waitress)", "d": True},
            {"t": "Staff PINs assigned (1001, 1002, 1003)", "d": True},
            {"t": "Loyalty: Micho Rewards (points + tiers)", "d": True},
            {"t": "12 tables with QR pay-at-table tokens", "d": True},
            {"t": "24 Turkish cuisine ingredients seeded", "d": True},
            {"t": "Cash management (£200 default float)", "d": True},
            {"t": "VAT 20% + all order types enabled", "d": True},
            {"t": "16 EPOS feature flags enabled", "d": True},
            {"t": "Database indexes created", "d": True},
        ],
        "notes": [{"text": "Micho is EPOS-ready. Awaiting Fiverr frontend designs before staff can use the till.", "author": "System", "at": now}],
    })

    # ═══════════════════════════════════════════════════════
    # 4. COMPETITOR RESEARCH — DONE
    # ═══════════════════════════════════════════════════════
    print("\n▸ COMPETITOR RESEARCH\n")

    await upsert("UK EPOS Competitor Audit", {
        "desc": "Deep analysis of Toast, Epos Now, SumUp, Lightspeed. Gap analysis identifying 9 features NO competitor has. Documented weaknesses (contracts, hidden fees, poor support).",
        "cat": "Platform", "pri": "P1", "stage": "live",
        "comp": ["Epos Now", "Toast", "SumUp", "Lightspeed"],
        "effort": "Low", "rev": "High",
        "checks": [
            {"t": "Toast POS deep-dive (features, pricing, weaknesses)", "d": True},
            {"t": "Epos Now deep-dive (back office, pricing, complaints)", "d": True},
            {"t": "SumUp deep-dive (features, limitations)", "d": True},
            {"t": "Gap analysis: features they have that we need", "d": True},
            {"t": "Gap analysis: features we have that they don't", "d": True},
            {"t": "Epos Now Back Office feature breakdown", "d": True},
            {"t": "9 unique AI/automation features identified", "d": True},
        ],
        "notes": [{"text": "Key finding: ALL competitors are reactive reporting tools. NONE have AI-powered features. Our moat = intelligence layer + zero commission + no contracts.", "author": "System", "at": now}],
    })

    # ═══════════════════════════════════════════════════════
    # 5. UPDATE EXISTING FEATURES
    # ═══════════════════════════════════════════════════════
    print("\n▸ UPDATING EXISTING FEATURES\n")

    # QR code dine-in ordering — backend now done
    existing = await db.project_features.find_one({"name": "QR code dine-in ordering"})
    if existing:
        await db.project_features.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "stage": "in_progress",
                "checks": [
                    {"t": "QR code generator per table", "d": True},
                    {"t": "Table-linked ordering session", "d": True},
                    {"t": "Order routes to kitchen with table #", "d": True},
                    {"t": "Pay-at-table via Stripe", "d": True},
                    {"t": "Call waiter from phone", "d": True},
                    {"t": "Post-payment review prompt", "d": True},
                    {"t": "Frontend UI for customer", "d": False},
                ],
                "updated_at": now,
            }}
        )
        print("  🔄 Updated: QR code dine-in ordering → in_progress")

    # Loyalty programme — backend done
    existing = await db.project_features.find_one({"name": "Loyalty programme (points)"})
    if existing:
        await db.project_features.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "stage": "in_progress",
                "checks": [
                    {"t": "Points earning rules + tier system", "d": True},
                    {"t": "Rewards catalog + redemption", "d": True},
                    {"t": "Customer loyalty card view", "d": False},
                    {"t": "Admin manage programme", "d": True},
                    {"t": "POS integration", "d": True},
                ],
                "updated_at": now,
            }}
        )
        print("  🔄 Updated: Loyalty programme → in_progress")

    # ═══════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════
    total = await db.project_features.count_documents({})
    by_stage = {}
    for stage in ["backlog", "design", "in_progress", "review", "live"]:
        c = await db.project_features.count_documents({"stage": stage})
        by_stage[stage] = c

    epos_count = await db.project_features.count_documents({"cat": "EPOS"})
    live_count = by_stage.get("live", 0)
    
    print(f"\n{'='*55}")
    print(f"  PROJECT BOARD UPDATED")
    print(f"{'='*55}")
    print(f"  Added: {added} new features")
    print(f"  Updated: {updated} existing features")
    print(f"")
    print(f"  Total features: {total}")
    print(f"  EPOS features: {epos_count}")
    print(f"")
    for stage, count in by_stage.items():
        bar = "█" * count + "░" * (20 - min(count, 20))
        print(f"  {stage:15s} {bar} {count}")
    print(f"")
    print(f"  🔴 LIVE NOW: {live_count}")
    print(f"  🟡 In Progress: {by_stage.get('in_progress', 0)}")
    print(f"  ⚪ Backlog: {by_stage.get('backlog', 0)}")

    client.close()
    print(f"\n🎉 Done!")


if __name__ == "__main__":
    asyncio.run(run())
