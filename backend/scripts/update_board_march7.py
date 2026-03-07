"""
Update Command Centre board with 7 Mar 2026 session work.
Run: cd /opt/rezvo-app && python3 backend/scripts/update_board_march7.py
"""
import asyncio
import os, sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv("/opt/rezvo-app/backend/.env")
sys.path.insert(0, "/opt/rezvo-app/backend")


async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    now = datetime.utcnow()

    async def upsert(title, data):
        existing = await db.command_centre_tasks.find_one({"title": title})
        if existing:
            await db.command_centre_tasks.update_one(
                {"_id": existing["_id"]},
                {"$set": {**data, "updated_at": now}}
            )
            print(f"  Updated: {title}")
        else:
            await db.command_centre_tasks.insert_one({
                **data, "title": title, "created_at": now, "updated_at": now
            })
            print(f"  Created: {title}")

    print("Updating Command Centre board — 7 Mar 2026 session\n")

    # ═══ COMPLETED ═══

    await upsert("Domain revert — rezvo.app (Option A)", {
        "status": "done",
        "priority": "critical",
        "category": "infrastructure",
        "desc": "All code reverted from reeveos.app to rezvo.app domains. 20 files changed. Matches VPS snapshot. CORS keeps both domain sets for future compat. Email addresses unchanged.",
        "commit": "dd2538d",
        "checklist": [
            {"t": "Frontend domain.js rewritten", "d": True},
            {"t": "Backend booking_page.py, insights.py, marketing.py URLs", "d": True},
            {"t": "Backend file paths /opt/reeveos-portal → /opt/rezvo-app", "d": True},
            {"t": "SupportBot API URLs", "d": True},
            {"t": "App.jsx booking redirects", "d": True},
            {"t": "All booking URLs aligned to book.rezvo.app", "d": True},
        ],
    })

    await upsert("Bookings page — business-type aware labels", {
        "status": "done",
        "priority": "critical",
        "category": "frontend",
        "desc": "Bookings.jsx now detects businessType. Salons: 'In Treatment/Client/Therapist/Service'. Restaurants: 'Seated/Guests/Table'. Detail panel adapts too. Search placeholder changes per type.",
        "commit": "13553b6",
    })

    await upsert("SupportBot z-index fix + position", {
        "status": "done",
        "priority": "critical",
        "category": "frontend",
        "desc": "SupportBot moved to bottom:90px (above Calendar FAB at bottom:24). z-index lowered from 9999 to 50 for bubble. Chat panel z-indexes unchanged when open.",
        "commit": "13553b6 + a678598",
    })

    await upsert("Cancellation policy enforcement", {
        "status": "done",
        "priority": "high",
        "category": "backend",
        "desc": "book.py cancel endpoint now checks cancellationNoticeHours before allowing. Returns 400 with clear message if within notice period. Supports 24/48/72hr tiers per business settings.",
        "commit": "13553b6",
    })

    await upsert("SMS wired via Sendly", {
        "status": "done",
        "priority": "high",
        "category": "backend",
        "desc": "SMS confirmation sent on booking creation + cancellation. Uses Sendly helper (backend/helpers/sms.py). Fails silently — booking still created if SMS fails. Templates for confirm/cancel/reminder exist.",
        "commit": "13553b6",
        "notes": [{"text": "Sendly API key must be set in .env as SENDLY_API_KEY for SMS to actually send", "author": "System", "at": now}],
    })

    await upsert("Calendar add-booking side panel (salon)", {
        "status": "done",
        "priority": "critical",
        "category": "frontend",
        "desc": "Right-side slide panel (like hospitality view). Client name, phone, email, treatment picker (loads from services-v2 API), therapist dropdown, date, time, notes. FAB simplified to single + button. Click empty slot pre-fills date/time/therapist.",
        "commit": "28b9512 + 76ceb0f + aee0539 + 6e455ef + a678598",
        "checklist": [
            {"t": "Side panel slides from right", "d": True},
            {"t": "Treatment picker loads services", "d": True},
            {"t": "Therapist dropdown from calendar staff", "d": True},
            {"t": "Click empty slot opens panel with pre-fill", "d": True},
            {"t": "FAB single button (removed broken menu items)", "d": True},
            {"t": "pointerEvents fix for hidden panel blocking clicks", "d": True},
            {"t": "JSX nesting rewritten clean", "d": True},
        ],
    })

    await upsert("Package tracking API + calendar display", {
        "status": "done",
        "priority": "high",
        "category": "backend + frontend",
        "desc": "Full packages API: list, create, use session, client packages. Calendar popover shows package progress dots (filled=used, empty=remaining) with remaining count. Answers 'How many sessions left?'",
        "commit": "2699c15",
        "checklist": [
            {"t": "GET /packages/business/:id — list all", "d": True},
            {"t": "GET /packages/business/:id/client/:clientId — active packages", "d": True},
            {"t": "POST /packages/business/:id — create package", "d": True},
            {"t": "POST /packages/business/:id/:pkgId/use — mark session used", "d": True},
            {"t": "Calendar popover shows progress dots", "d": True},
            {"t": "Auto-complete when all sessions used", "d": True},
        ],
    })

    await upsert("Therapist notes + calendar popover enrichment", {
        "status": "done",
        "priority": "medium",
        "category": "backend + frontend",
        "desc": "Calendar popover shows booking notes in amber box. Calendar APIs now return customerId, customerPhone, price, notes. Fixed crash bug in clients.py add_note (undefined 'user' variable).",
        "commit": "273f23e",
    })

    await upsert("Seed data fix — staffId on bookings", {
        "status": "done",
        "priority": "critical",
        "category": "data",
        "desc": "Root cause: seed_rejuvenate.py stored staff_name but no staffId. Calendar renders by staffId columns. All 991 bookings patched with fix_rejuvenate_bookings.py. Seed script fixed for future runs. Upcoming bookings seeded (today + 7 days).",
        "commit": "2efe70d + 8df21ba",
    })

    await upsert("Calendar click interactions fixed", {
        "status": "done",
        "priority": "high",
        "category": "frontend",
        "desc": "Three fixes: (1) Drag threshold 5px so clicks pass through to popover. (2) Click empty slot opens booking panel with pre-filled time/staff. (3) SupportBot back on calendar at higher position.",
        "commit": "a678598",
    })

    await upsert("SupportBot business-aware context", {
        "status": "done",
        "priority": "high",
        "category": "backend + frontend",
        "desc": "Backend chatbot.py builds different data snapshots for restaurants (covers/tables/party sizes) vs services (appointments/revenue/treatments/therapists). Suggested questions adapt per business type. System prompt no longer restaurant-only.",
        "commit": "b35b197",
    })

    await upsert("SECURITY: Chatbot business data isolation", {
        "status": "done",
        "priority": "critical",
        "category": "security",
        "desc": "SupportBot was sending chat requests WITHOUT auth token. Business data in AI responses was effectively accessible without authentication. Fixed: auth token now included, business_id derived server-side (never trusted from client), regular users ALWAYS see only their own business.",
        "commit": "3e00c16",
        "checklist": [
            {"t": "Auth token on chat requests", "d": True},
            {"t": "Server-side business_id derivation", "d": True},
            {"t": "Security warning logged on cross-business attempt", "d": True},
            {"t": "All other endpoints verified with verify_business_access", "d": True},
        ],
    })

    # ═══ TODO — NEXT SESSION ═══

    await upsert("Service-swap on existing booking", {
        "status": "todo",
        "priority": "high",
        "category": "frontend + backend",
        "desc": "Natalie's #1 frustration with current system (Sesame). Cannot change treatment type on existing booking without cancel+rebook. Need edit modal on booking detail with service picker.",
    })

    await upsert("Medical changes quick-update prompt", {
        "status": "todo",
        "priority": "high",
        "category": "frontend",
        "desc": "Returning clients must redo full 50+ field form. Natalie wants 'Any medical changes since last visit?' shortcut. If changes flagged, update record + alert therapist on booking day.",
    })

    await upsert("Aftercare automation", {
        "status": "todo",
        "priority": "medium",
        "category": "backend",
        "desc": "Auto-send treatment-specific aftercare email 15-30 min after appointment marked completed. Natalie has content on her website. Email helper exists, trigger on status change needed.",
    })

    await upsert("Patch test tracking", {
        "status": "todo",
        "priority": "medium",
        "category": "backend + frontend",
        "desc": "Auto-schedule 48hr patch test before first microneedling/peel. 'Pending Patch Test' status blocks check-in. From consultation form spec.",
    })

    await upsert("Treatment consent forms (2A-2D)", {
        "status": "todo",
        "priority": "medium",
        "category": "frontend + backend",
        "desc": "Per-treatment consent forms: Microneedling, Chemical Peel, RF Needling, Polynucleotides. Signed before each treatment/course. Shorter than consultation form. From spec doc.",
    })

    await upsert("Consultation form expiry enforcement", {
        "status": "todo",
        "priority": "high",
        "category": "frontend",
        "desc": "Backend tracks expires_at (6 months). Frontend needs to check and prompt re-review before next booking if expired. Banner in client portal.",
    })

    # Count
    done = await db.command_centre_tasks.count_documents({"status": "done"})
    todo = await db.command_centre_tasks.count_documents({"status": "todo"})
    ip = await db.command_centre_tasks.count_documents({"status": "in_progress"})
    print(f"\nBoard updated: {done} done, {ip} in progress, {todo} todo")


asyncio.run(main())
